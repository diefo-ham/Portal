import { useEffect, useMemo, useRef, useState } from "react";
import { sectionLabel } from "../core/assessments";
import { deleteSession, renameSession } from "../core/commands";
import type { SegmentKey, Section, Session, StudyData } from "../core/model";
import { numericValue } from "../core/practice";
import { SESSION_NAME_MAX_LENGTH } from "../core/sessions";
import { timerWarning } from "../core/practiceTest";
import {
  PART_ORDER,
  REAL_TEST,
  beginTimedTest,
  currentSegment,
  endTimedSegment,
  goToTimedQuestion,
  pauseTimedTest,
  planSegments,
  resumeTimedTest,
  saveTimedAnswer,
  segmentElapsed,
  segmentLabel,
  startNextTimedSegment,
  timedExpired,
  timedRemaining,
  timedSummary,
  timedTestPool,
  toggleTimedMark,
} from "../core/timedTest";
import { DocumentPanels } from "./DocumentPanels";
import { TimedTestResults } from "./TimedTestResults";
import { formatElapsed } from "./formatTime";
import { useQuestionTimer } from "./useQuestionTimer";

/**
 * PAA test mode, as close to the real test as the sources allow: the parts in
 * their order, each with its own clock and locked once it ends, no feedback,
 * no pause during a part, and a break between parts. The PAA portal is in
 * Spanish, so this screen is written in Spanish directly instead of going
 * through the translation table.
 */
type Mutate = (fn: (data: StudyData) => void) => Promise<StudyData>;

const clock = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const rest = `${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return hours ? `${hours}:${rest}` : rest;
};
const hoursAndMinutes = (minutes: number) =>
  minutes >= 60
    ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`
    : `${minutes} min`;
const questions = (n: number) => `${n} ${n === 1 ? "pregunta" : "preguntas"}`;

const ALL_PARTS: Section[] = [...PART_ORDER];
const FIRST_THREE: Section[] = ["lectura", "redaccion", "matematicas"];
const sameParts = (a: readonly Section[], b: readonly Section[]) =>
  a.length === b.length && a.every((part) => b.includes(part));

export function TimedTestSetup({
  data,
  mutate,
  onOpen,
  removesAnswers = false,
  onAddQuestions,
}: {
  data: StudyData;
  mutate: Mutate;
  onOpen: (id: string) => void;
  removesAnswers?: boolean;
  onAddQuestions?: () => void;
}) {
  const [parts, setParts] = useState<Section[]>(ALL_PARTS);
  const [unusedOnly, setUnusedOnly] = useState(true);
  const [timed, setTimed] = useState(true);
  // What was typed by hand. Until then the size and the times follow the choices above them.
  const [typedCount, setTypedCount] = useState<string>();
  const [typedMinutes, setTypedMinutes] = useState<
    Partial<Record<SegmentKey, string>>
  >({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [menuId, setMenuId] = useState("");
  const [renameTarget, setRenameTarget] = useState<Session>();
  const [deleteTarget, setDeleteTarget] = useState<Session>();
  const [name, setName] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);
  const pool = useMemo(
    () => timedTestPool(data, parts, unusedOnly),
    [data, parts, unusedOnly],
  );
  const available = pool.length;
  const count = typedCount ?? String(available);
  const wanted = /^\d+$/.test(count) ? Number(count) : 0;
  const validCount = wanted >= 1 && wanted <= available;
  const plan = useMemo(
    () => planSegments(pool, validCount ? wanted : available),
    [pool, validCount, wanted, available],
  );
  const minutesOf = (segment: (typeof plan)[number]) =>
    typedMinutes[segment.key] ?? String(segment.minutes);
  const minutesOk = plan.every(
    (segment) =>
      /^\d+$/.test(minutesOf(segment)) && Number(minutesOf(segment)) >= 1,
  );
  const unfinished = data.sessions.find((s) => s.timedTest && !s.finishedAt);
  const tests = data.sessions.filter((s) => s.timedTest).toReversed();
  useEffect(() => {
    if (renameTarget) nameInput.current?.select();
  }, [renameTarget]);
  const openRename = (session: Session) => {
    setMenuId("");
    setName(session.name || "Prueba");
    setRenameTarget(session);
  };
  const saveRename = async () => {
    if (!renameTarget) return;
    setBusy(true);
    try {
      await mutate((d) => renameSession(d, renameTarget.id, name));
      setRenameTarget(undefined);
    } finally {
      setBusy(false);
    }
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await mutate((d) => deleteSession(d, deleteTarget.id, removesAnswers));
      setDeleteTarget(undefined);
    } finally {
      setBusy(false);
    }
  };
  const preset = (next: Section[]) => {
    setParts(next);
    setTypedCount(undefined);
    setTypedMinutes({});
  };
  const toggle = (part: Section) => {
    const next = parts.includes(part)
      ? parts.filter((id) => id !== part)
      : PART_ORDER.filter((id) => id === part || parts.includes(id));
    if (next.length) preset(next);
  };
  const start = async () => {
    setBusy(true);
    setError("");
    try {
      let id = "";
      await mutate((d) => {
        id = beginTimedTest(d, {
          parts,
          count: wanted,
          unusedOnly,
          ...(timed
            ? {
                limitMinutes: Object.fromEntries(
                  plan.map((segment) => [
                    segment.key,
                    Number(minutesOf(segment)),
                  ]),
                ),
              }
            : {}),
        }).id;
      });
      onOpen(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="page narrow test-mode-page">
      <p className="eyebrow">PRUEBA CRONOMETRADA</p>
      <h1>Modo de prueba</h1>
      <p className="muted">
        Las partes van en el orden de la PAA, cada una con su propio reloj, y no
        ves si acertaste hasta el final.
      </p>
      {unfinished && (
        <section className="continue-area" aria-label="Prueba sin terminar">
          <h2>Tienes una prueba sin terminar</h2>
          <p className="muted">
            Retómala o cancélala desde «Tus pruebas» para preparar otra.
          </p>
        </section>
      )}
      {!data.questions.length ? (
        <section className="empty-state">
          <h2>Agrega tus preguntas para empezar.</h2>
          <p>Agrega tus PDF de preguntas y se preparan en este dispositivo.</p>
          {onAddQuestions && (
            <button className="primary" onClick={onAddQuestions}>
              Agrega tus PDF de preguntas
            </button>
          )}
        </section>
      ) : (
        !unfinished && (
          <section className="practice-composer" aria-label="Nueva prueba">
            <div className="section-heading">
              <h2>Prepara tu prueba</h2>
            </div>
            <div className="test-presets">
              <button
                aria-pressed={sameParts(parts, ALL_PARTS)}
                onClick={() => preset(ALL_PARTS)}
              >
                Prueba completa · las cuatro partes
              </button>
              <button
                aria-pressed={sameParts(parts, FIRST_THREE)}
                onClick={() => preset(FIRST_THREE)}
              >
                Lectura, Redacción y Matemáticas
              </button>
              <button
                aria-pressed={sameParts(parts, ["ingles"])}
                onClick={() => preset(["ingles"])}
              >
                Inglés
              </button>
            </div>
            <div className="filters">
              <div className="section-filter wide">
                <span className="filter-label">Partes</span>
                <div
                  className="section-segments"
                  role="group"
                  aria-label="Partes"
                >
                  {PART_ORDER.map((part) => (
                    <button
                      type="button"
                      key={part}
                      aria-pressed={parts.includes(part)}
                      onClick={() => toggle(part)}
                    >
                      {sectionLabel(part)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <label className="check-filter test-option">
              <input
                type="checkbox"
                checked={unusedOnly}
                onChange={(e) => {
                  setUnusedOnly(e.target.checked);
                  setTypedCount(undefined);
                  setTypedMinutes({});
                }}
              />{" "}
              Solo preguntas que no he contestado
            </label>
            <p className="small muted">
              {unusedOnly
                ? "Se evitan las preguntas que ya contestaste en la práctica o en otra prueba."
                : "Pueden salir preguntas que ya contestaste."}{" "}
              Disponibles: {available}.
            </p>
            <div className="composer-start">
              <label>
                Número de preguntas
                <input
                  className="session-size-input"
                  type="text"
                  inputMode="numeric"
                  value={count}
                  aria-invalid={count !== "" && !validCount}
                  onChange={(e) => {
                    if (/^\d*$/.test(e.target.value)) {
                      setTypedCount(e.target.value);
                    }
                  }}
                />
              </label>
            </div>
            <label className="check-filter test-option">
              <input
                type="checkbox"
                checked={timed}
                onChange={(e) => setTimed(e.target.checked)}
              />{" "}
              Con límite de tiempo
            </label>
            {plan.length > 0 && (
              <table className="part-plan">
                <caption className="sr-only">Partes de la prueba</caption>
                <thead>
                  <tr>
                    <th scope="col">Parte</th>
                    <th scope="col">Preguntas</th>
                    <th scope="col">Tiempo (minutos)</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.map((segment) => (
                    <tr key={segment.key}>
                      <th scope="row">{segmentLabel(segment)}</th>
                      <td>{segment.questions}</td>
                      <td>
                        <input
                          className="session-size-input"
                          type="text"
                          inputMode="numeric"
                          aria-label={`Tiempo de ${segmentLabel(segment)} (minutos)`}
                          value={timed ? minutesOf(segment) : ""}
                          disabled={!timed}
                          aria-invalid={
                            timed && !/^\d+$/.test(minutesOf(segment))
                          }
                          onChange={(e) => {
                            if (/^\d*$/.test(e.target.value)) {
                              setTypedMinutes({
                                ...typedMinutes,
                                [segment.key]: e.target.value,
                              });
                            }
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="test-rules small muted">
              <p>
                <strong>Como en la prueba real:</strong> cada parte tiene su
                propio reloj; cuando termina una parte (tú o el reloj) ya no
                puedes volver a ella; no hay penalidad por contestar mal, así
                que contesta todas. Entre una parte y la siguiente puedes
                descansar: el reloj de la siguiente no corre hasta que la
                empieces.
              </p>
              <p>
                En la prueba real: Lectura y Redacción,{" "}
                {questions(REAL_TEST.lecturaRedaccion.questions)} en{" "}
                {REAL_TEST.lecturaRedaccion.minutes} min; Matemáticas,{" "}
                {REAL_TEST.matematicas.questions} en{" "}
                {REAL_TEST.matematicas.minutes} min; Inglés,{" "}
                {REAL_TEST.ingles.questions} en {REAL_TEST.ingles.minutes} min.
                Con este banco puedes tener menos preguntas, y los tiempos
                sugeridos siguen el mismo ritmo.{" "}
                {timed
                  ? "Al acabarse el tiempo de una parte, esa parte termina sola."
                  : "Sin límite: cada reloj cuenta el tiempo que llevas."}{" "}
                La prueba real no tiene pausa: aquí, si sales, el reloj de la
                parte se detiene.
              </p>
            </div>
            <button
              className="primary"
              disabled={busy || !validCount || (timed && !minutesOk)}
              onClick={() => void start()}
            >
              Empezar la prueba →
            </button>
            {error && <p role="alert">{error}</p>}
          </section>
        )
      )}
      {tests.length > 0 && (
        <section className="utility practice-test-list-section">
          <h2>Tus pruebas</h2>
          <div className="practice-test-list" role="list">
            {tests.map((session) => {
              const summary = session.finishedAt
                ? timedSummary(data, session)
                : undefined;
              return (
                <div
                  className="practice-test-row"
                  role="listitem"
                  key={session.id}
                >
                  <div className="practice-test-row-copy">
                    <span className="practice-test-row-name">
                      {session.name}
                    </span>
                    <span className="practice-test-row-meta">
                      {new Date(session.startedAt).toLocaleDateString()}
                      {summary
                        ? ` · ${summary.correct} de ${summary.total} correctas (${summary.percent}%) · ${formatElapsed(session.timedTest!.durationMs ?? 0)}`
                        : " · en curso"}
                    </span>
                  </div>
                  <div className="practice-test-row-actions">
                    <button onClick={() => onOpen(session.id)}>
                      {session.finishedAt ? "Ver resultados" : "Retomar"}
                    </button>
                    <div className="session-action-wrap">
                      <button
                        className="session-menu-trigger"
                        aria-label={`Acciones de ${session.name}`}
                        aria-expanded={menuId === session.id}
                        onClick={() =>
                          setMenuId(menuId === session.id ? "" : session.id)
                        }
                      >
                        •••
                      </button>
                      {menuId === session.id && (
                        <div className="session-menu" role="menu">
                          <button
                            role="menuitem"
                            onClick={() => openRename(session)}
                          >
                            Renombrar
                          </button>
                          <button
                            className="danger"
                            role="menuitem"
                            onClick={() => {
                              setMenuId("");
                              setDeleteTarget(session);
                            }}
                          >
                            {session.finishedAt
                              ? "Borrar examen"
                              : "Cancelar la prueba"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {renameTarget && (
        <div className="portal-modal-backdrop" role="presentation">
          <section
            className="portal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-test-heading"
          >
            <p className="eyebrow">MODO DE PRUEBA</p>
            <h2 id="rename-test-heading">Renombrar la prueba</h2>
            <label>
              Nombre de la prueba
              <input
                ref={nameInput}
                value={name}
                maxLength={SESSION_NAME_MAX_LENGTH}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void saveRename();
                }}
              />
            </label>
            <div className="modal-actions">
              <button onClick={() => setRenameTarget(undefined)}>
                Cancelar
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void saveRename()}
              >
                Guardar nombre
              </button>
            </div>
          </section>
        </div>
      )}
      {deleteTarget && (
        <div className="portal-modal-backdrop" role="presentation">
          <section
            className="portal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-test-heading"
          >
            <p className="eyebrow">
              {deleteTarget.finishedAt ? "BORRAR EXAMEN" : "CANCELAR LA PRUEBA"}
            </p>
            <h2 id="delete-test-heading">
              {deleteTarget.finishedAt
                ? "¿Borrar esta prueba?"
                : "¿Abandonar esta prueba?"}
            </h2>
            <p>
              {deleteTarget.finishedAt
                ? `Se borra «${deleteTarget.name}» con sus resultados. `
                : `Se quita «${deleteTarget.name}» sin resultados. `}
              {removesAnswers
                ? "Sus respuestas también se quitarán de tu progreso y esas preguntas volverán a quedar sin contestar."
                : "Tus respuestas se conservan en tu historial de estudio."}
            </p>
            <div className="modal-actions">
              <button onClick={() => setDeleteTarget(undefined)}>
                Conservar la prueba
              </button>
              <button
                className="danger"
                disabled={busy}
                onClick={() => void confirmDelete()}
              >
                {deleteTarget.finishedAt
                  ? "Borrar examen"
                  : "Cancelar la prueba"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export function TimedTestRun({
  data,
  session,
  mutate,
  onBack,
  onRetry,
}: {
  data: StudyData;
  session: Session;
  mutate: Mutate;
  onBack: () => void;
  onRetry: (ids: string[], kind: "mistakes" | "unanswered" | "entire") => void;
}) {
  if (session.finishedAt)
    return (
      <TimedTestResults
        data={data}
        session={session}
        mutate={mutate}
        onBack={onBack}
        onRetry={onRetry}
      />
    );
  return session.timedTest!.phase === "break" ? (
    <BreakScreen session={session} mutate={mutate} onBack={onBack} />
  ) : (
    <LiveTest data={data} session={session} mutate={mutate} onBack={onBack} />
  );
}

/** Between parts: no clock runs until the next part is started. */
function BreakScreen({
  session,
  mutate,
  onBack,
}: {
  session: Session;
  mutate: Mutate;
  onBack: () => void;
}) {
  const test = session.timedTest!;
  const done = currentSegment(test);
  const next = test.segments[test.current + 1];
  const [pending, setPending] = useState(false);
  return (
    <main className="practice-page focused-practice">
      <div className="practice-toolbar">
        <button className="text-button" onClick={onBack}>
          ← Salir
        </button>
      </div>
      <section className="test-paused-card test-break">
        <p className="eyebrow">DESCANSO</p>
        <h1>Terminaste {segmentLabel(done)}.</h1>
        <p>
          Sigue <strong>{segmentLabel(next)}</strong>:{" "}
          {questions(next.questionIds.length)}
          {next.limitMs !== undefined
            ? `, ${hoursAndMinutes(Math.round(next.limitMs / 60000))}`
            : ", sin límite de tiempo"}
          . Esa parte tiene su propio reloj. Ya no puedes volver a las partes
          anteriores.
        </p>
        <p className="muted">
          Descansa lo que necesites: el reloj de la siguiente parte no corre
          hasta que la empieces. Recuerda que no hay penalidad por contestar
          mal.
        </p>
        <button
          className="primary"
          disabled={pending}
          onClick={() => {
            setPending(true);
            void mutate((d) => startNextTimedSegment(d, session.id)).finally(
              () => setPending(false),
            );
          }}
        >
          Empezar {segmentLabel(next)}
        </button>
      </section>
    </main>
  );
}

function LiveTest({
  data,
  session,
  mutate,
  onBack,
}: {
  data: StudyData;
  session: Session;
  mutate: Mutate;
  onBack: () => void;
}) {
  const test = session.timedTest!;
  const segment = currentSegment(test);
  const ids = segment.questionIds;
  const lastPart = test.current === test.segments.length - 1;
  // An earlier part is locked: a stored position outside this part is moved to its first question.
  const position = Math.max(0, ids.indexOf(session.questionIds[session.index]));
  const question = data.questions.find((q) => q.id === ids[position])!;
  const [now, setNow] = useState(() => Date.now());
  const [pending, setPending] = useState(false);
  const [panel, setPanel] = useState<"finish" | null>(null);
  // The overview page, like the SAT Practice Test's: any question, and finishing.
  const [reviewing, setReviewing] = useState(false);
  const [draft, setDraft] = useState<{ id: string; value: string }>();
  const dialog = useRef<HTMLDialogElement>(null);
  const top = useRef<HTMLElement>(null);
  const answer =
    draft?.id === question.id
      ? draft.value
      : (session.drafts[question.id] ?? "");
  const marked = test.marked.includes(question.id);
  const timer = useQuestionTimer(
    session.id,
    question.id,
    !session.paused && !reviewing,
    mutate,
  );
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, []);
  // Time ran out (also if the browser was closed while the clock was running).
  const expired = timedExpired(session, now);
  useEffect(() => {
    if (expired) void mutate((d) => endTimedSegment(d, session.id));
  }, [expired, mutate, session.id]);
  useEffect(() => {
    if (panel) {
      if (!dialog.current?.open) dialog.current?.showModal();
    } else if (dialog.current?.open) dialog.current.close();
  }, [panel]);
  useEffect(() => {
    top.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [question.id]);
  const run = async (fn: () => Promise<unknown>) => {
    setPending(true);
    try {
      await fn();
    } catch {
      /* the global error banner reports it */
    } finally {
      setPending(false);
    }
  };
  const go = (target: number) =>
    run(async () => {
      await timer.flush();
      await mutate((d) =>
        goToTimedQuestion(
          d,
          session.id,
          session.questionIds.indexOf(ids[target]),
        ),
      );
    });
  const choose = (value: string) => {
    if (session.paused) return;
    setDraft({ id: question.id, value });
    void mutate((d) =>
      saveTimedAnswer(d, session.id, question.id, value),
    ).catch(() => {});
  };
  const openOverview = () =>
    run(async () => {
      await timer.flush();
      setReviewing(true);
    });
  const goFromOverview = (target: number) => {
    setReviewing(false);
    return go(target);
  };
  const finishPart = () =>
    run(async () => {
      await timer.flush();
      setPanel(null);
      await mutate((d) => endTimedSegment(d, session.id));
    });
  // Leaving stops the part's clock (the real test has no pause, but people are interrupted).
  const leave = () =>
    run(async () => {
      await timer.flush();
      await mutate((d) => pauseTimedTest(d, session.id));
      onBack();
    });
  const remaining = timedRemaining(test, now);
  const shown = remaining ?? segmentElapsed(segment, now);
  const answered = ids.filter((id) => session.drafts[id]).length;
  const markedCount = test.marked.length;
  const last = position === ids.length - 1;
  const hasAnswer =
    !!answer &&
    (question.answer.type === "choice" || numericValue(answer) !== undefined);
  // Enter moves on once there is an answer; from the last question it opens the overview.
  const advance = () => {
    if (last) void openOverview();
    else void go(position + 1);
  };
  const unanswered = ids.length - answered;
  return (
    <main
      className="practice-page focused-practice"
      onKeyDown={(e) => {
        if (
          e.defaultPrevented ||
          session.paused ||
          panel ||
          reviewing ||
          pending ||
          e.altKey ||
          e.ctrlKey ||
          e.metaKey ||
          e.shiftKey ||
          e.repeat ||
          (e.target instanceof HTMLElement &&
            e.target.closest('input:not([type="radio"]),textarea,select'))
        )
          return;
        const choice = /^[1-4]$/.test(e.key)
          ? question.choices?.[Number(e.key) - 1]
          : question.choices?.find(
              (c) => c.id.toLowerCase() === e.key.toLowerCase(),
            );
        if (question.answer.type === "choice" && choice) {
          e.preventDefault();
          choose(answer === choice.id ? "" : choice.id);
        } else if (e.key === "ArrowLeft" && position > 0) {
          e.preventDefault();
          void go(position - 1);
        } else if (e.key === "ArrowRight" && !last) {
          e.preventDefault();
          void go(position + 1);
        } else if (
          e.key.toLowerCase() === "e" &&
          !(e.target instanceof HTMLElement && e.target.closest("button"))
        ) {
          e.preventDefault();
          void mutate((d) => toggleTimedMark(d, session.id, question.id));
        } else if (
          e.key === "Enter" &&
          hasAnswer &&
          !(e.target instanceof HTMLElement && e.target.closest("button,a"))
        ) {
          e.preventDefault();
          advance();
        }
      }}
    >
      <div className="practice-toolbar">
        <button
          className="text-button"
          disabled={pending}
          title="Al salir, el reloj de esta parte se detiene. En la prueba real no hay pausa."
          onClick={() => void leave()}
        >
          ← Salir
        </button>
        <button
          className="text-button"
          aria-label="Abrir el resumen de preguntas"
          disabled={pending}
          onClick={() => void openOverview()}
        >
          {reviewing ? (
            "Resumen de preguntas"
          ) : (
            <>
              Pregunta {position + 1}{" "}
              <span className="muted">de {ids.length}</span>
            </>
          )}
        </button>
        <div className="toolbar-right">
          <span className="muted small test-part-name">
            {segmentLabel(segment)}
          </span>
          <span
            className={`timer test-timer ${remaining !== undefined && timerWarning(remaining) ? "timer-warning" : ""}`}
            aria-label={
              remaining === undefined
                ? "Tiempo transcurrido"
                : "Tiempo restante"
            }
          >
            {clock(shown)}
          </span>
          {!reviewing && (
            <button disabled={pending} onClick={() => void openOverview()}>
              Resumen
            </button>
          )}
        </div>
      </div>
      {reviewing ? (
        <section className="test-overview-content">
          <p className="eyebrow">REVISA TU TRABAJO</p>
          <h1>Resumen de preguntas</h1>
          <p className="muted">
            Revisa cualquier pregunta antes de terminar. Lo contestado y lo
            marcado se muestran por separado. Puedes volver a cualquiera de esta
            parte.
          </p>
          <div
            className="overview-legend"
            aria-label="Leyenda de las preguntas"
          >
            <span>
              <i className="status-dot answered" /> Contestada
            </span>
            <span>
              <i className="status-dot unanswered" /> Sin contestar
            </span>
            <span>
              <i className="status-flag">⚑</i> Marcada para revisar
            </span>
          </div>
          <div className="test-question-grid">
            {ids.map((id, index) => {
              const done = !!session.drafts[id];
              const review = test.marked.includes(id);
              return (
                <button
                  key={id}
                  className={`${done ? "answered" : "unanswered"} ${review ? "marked" : ""}`}
                  disabled={pending}
                  aria-label={`Ir a la pregunta ${index + 1}${done ? ", contestada" : ", sin contestar"}${review ? ", marcada para revisar" : ""}`}
                  aria-current={index === position ? "step" : undefined}
                  onClick={() => void goFromOverview(index)}
                >
                  <strong aria-hidden="true">{index + 1}</strong>
                  <span>{done ? "Contestada" : "Sin contestar"}</span>
                  {review && <span className="marked-label">⚑ Marcada</span>}
                </button>
              );
            })}
          </div>
          <div className="overview-finish">
            <p>
              {unanswered ? `${unanswered} sin contestar` : "Todas contestadas"}
            </p>
            <button
              disabled={pending}
              onClick={() => void goFromOverview(position)}
            >
              Volver a la pregunta {position + 1}
            </button>
            <button
              className="primary"
              disabled={pending}
              onClick={() => setPanel("finish")}
            >
              {lastPart ? "Terminar la prueba" : "Terminar esta parte"}
            </button>
          </div>
        </section>
      ) : (
        <>
          <div className="progress-track">
            <div
              role="progressbar"
              aria-label="Preguntas contestadas en esta parte"
              aria-valuemin={0}
              aria-valuemax={ids.length}
              aria-valuenow={answered}
              style={{ width: `${(100 * answered) / ids.length}%` }}
            />
          </div>
          <div className="practice-layout">
            <article
              className="question-card"
              key={question.id}
              ref={top}
              tabIndex={-1}
              aria-label={`Pregunta ${position + 1}`}
            >
              <div className="question-heading">
                <div>
                  <p className="eyebrow">{sectionLabel(question.section)}</p>
                  <span className="muted small">{question.domain || ""}</span>
                </div>
                <button
                  className={`review-mark ${marked ? "selected" : ""}`}
                  aria-pressed={marked}
                  title="Marcar para revisar (E)"
                  onClick={() =>
                    void mutate((d) =>
                      toggleTimedMark(d, session.id, question.id),
                    )
                  }
                >
                  <span aria-hidden="true">{marked ? "⚑" : "⚐"}</span>
                  <span>Marcar para revisar</span>
                </button>
              </div>
              {question.passage && !question.document && (
                <div className="passage">{question.passage}</div>
              )}
              {question.document ? (
                <>
                  <h1 className="sr-only">Pregunta {question.sourceId}</h1>
                  {question.document.extractionWarnings?.map((warning, i) => (
                    <p className="notice" key={i}>
                      {warning}
                    </p>
                  ))}
                  <DocumentPanels question={question} kind="question" />
                  <p className="small muted">
                    {question.answer.type === "choice"
                      ? "Selecciona una respuesta entre las opciones de arriba."
                      : "Escribe tu respuesta abajo."}
                  </p>
                </>
              ) : (
                <h1 className="question-text">{question.stem}</h1>
              )}
              <fieldset
                className="answers"
                disabled={pending || session.paused}
              >
                <legend className="sr-only">Tu respuesta</legend>
                {question.answer.type === "choice" ? (
                  question.choices!.map((c) => (
                    <label
                      className={`answer-choice ${answer === c.id ? "chosen" : ""}`}
                      key={c.id}
                    >
                      <input
                        type="radio"
                        name="answer"
                        value={c.id}
                        checked={answer === c.id}
                        onClick={() => {
                          if (answer === c.id) choose("");
                        }}
                        onChange={() => choose(c.id)}
                      />
                      <span className="choice-letter">{c.id}</span>
                      {!question.document && <span>{c.text}</span>}
                    </label>
                  ))
                ) : (
                  <label className="numeric-answer">
                    Tu respuesta
                    <input
                      aria-label="Tu respuesta numérica"
                      inputMode="text"
                      value={answer}
                      placeholder="Escribe un número o una fracción"
                      onChange={(e) => choose(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && hasAnswer && !pending) {
                          e.preventDefault();
                          advance();
                        }
                      }}
                    />
                    <span className="small muted">
                      Solo números positivos, de hasta 4 caracteres (por
                      ejemplo, 7.5 o 15/2). No se aceptan números mixtos.
                    </span>
                    {answer && numericValue(answer) === undefined && (
                      <span className="incorrect small">
                        Escribe un número válido o una fracción con denominador
                        distinto de cero.
                      </span>
                    )}
                  </label>
                )}
              </fieldset>
              <div className="question-footer">
                <button
                  disabled={position === 0 || pending || session.paused}
                  onClick={() => void go(position - 1)}
                >
                  ← Anterior
                </button>
                {last ? (
                  <button
                    className="text-button"
                    disabled={pending || session.paused}
                    onClick={() => void openOverview()}
                  >
                    Revisar y terminar →
                  </button>
                ) : (
                  <button
                    className="primary"
                    disabled={pending || session.paused}
                    onClick={() => void go(position + 1)}
                  >
                    Siguiente pregunta →
                  </button>
                )}
              </div>
            </article>
          </div>
        </>
      )}
      <dialog
        ref={dialog}
        className="practice-dialog"
        onCancel={() => setPanel(null)}
        onClose={() => setPanel(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setPanel(null);
        }}
      >
        <div className="dialog-heading">
          <h2>{lastPart ? "¿Terminar la prueba?" : "¿Terminar esta parte?"}</h2>
          <button aria-label="Cerrar el panel" onClick={() => setPanel(null)}>
            ×
          </button>
        </div>
        {panel === "finish" && (
          <div className="tool-menu">
            <p>
              Contestaste {answered} de {ids.length}
              {markedCount
                ? markedCount === 1
                  ? "; 1 sigue marcada para revisar"
                  : `; ${markedCount} siguen marcadas para revisar`
                : ""}
              .{" "}
              {lastPart
                ? "Al terminar se calculan los resultados y ya no podrás cambiar tus respuestas."
                : "Cuando termines esta parte ya no podrás volver a ella."}{" "}
              No hay penalidad por contestar mal: las preguntas sin contestar
              cuentan como incorrectas.
            </p>
            <button onClick={() => setPanel(null)}>Seguir</button>
            <button
              className="primary"
              disabled={pending}
              onClick={() => void finishPart()}
            >
              {lastPart ? "Terminar la prueba" : "Terminar esta parte"}
            </button>
          </div>
        )}
      </dialog>
      {session.paused && (
        <div
          className="test-paused-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="paused-heading"
        >
          <section className="test-paused-card">
            <p className="eyebrow">RELOJ DETENIDO</p>
            <h1 id="paused-heading">Saliste de la prueba.</h1>
            <p className="muted">
              El reloj de esta parte está detenido. Las preguntas y tus
              respuestas no están disponibles hasta que sigas.
            </p>
            <button
              className="primary"
              disabled={pending}
              onClick={() =>
                void run(() => mutate((d) => resumeTimedTest(d, session.id)))
              }
            >
              Seguir con la prueba
            </button>
            <button className="text-button" disabled={pending} onClick={onBack}>
              Volver
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
