import { useRef, useState, type MouseEvent } from "react";
import { assessmentInfo } from "../core/assessments";
import { useAssessment, useT } from "./i18n";

export function ShortcutHelp() {
  const t = useT();
  const calculator = assessmentInfo(useAssessment()).calculator;
  return (
    <div className="shortcut-help">
      <dl>
        <dt>← / →</dt>
        <dd>{t("Previous / next question")}</dd>
        <dt>1–4</dt>
        <dd>{t("Choose answer A–D (letters also work while reading)")}</dd>
        <dt>Enter / Space</dt>
        <dd>
          {t(
            "Check your answer; after feedback, advance or review the session",
          )}
        </dd>
        <dt>E</dt>
        <dd>{t("Toggle the current question’s bookmark")}</dd>
        {calculator && (
          <>
            <dt>\</dt>
            <dd>Toggle calculator</dd>
          </>
        )}
        <dt>Escape</dt>
        <dd>
          {t(
            "Close a temporary panel first. While reading, open Leave session; press Escape again to leave.",
          )}
        </dd>
      </dl>
      <p className="small muted">
        {t(
          "Shortcuts apply while reading. Focused controls keep their normal keys; Enter also submits a selected answer choice or numeric answer. Use Tab to reach controls and Space to activate them.",
        )}
      </p>
      <p className="small muted">
        {t(
          "Exit saves your place. Resume any unfinished set from Practice. Find saved questions in Review → Bookmarks. The question number opens the session map. Practice tools contain timing and question details.",
        )}
      </p>
    </div>
  );
}

export function Help() {
  return useAssessment() === "PAA" ? <PaaHelp /> : <SatHelp />;
}

function PaaHelp() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => dialog.current?.close();
  return (
    <>
      <button
        ref={trigger}
        className="text-button help-link"
        aria-label="Ayuda y atajos de teclado"
        onClick={() => dialog.current?.showModal()}
      >
        Ayuda
      </button>
      <dialog
        ref={dialog}
        className="practice-dialog help-dialog"
        aria-labelledby="help-title"
        onClose={() => trigger.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="dialog-heading">
          <h2 id="help-title">Cómo usar PAA Study</h2>
          <button aria-label="Cerrar la ayuda" onClick={close}>
            ×
          </button>
        </div>
        <div className="help-content">
          <section className="help-overview" aria-label="Resumen de PAA Study">
            <p>
              PAA Study tiene cuatro áreas: practica un grupo de preguntas,
              repasa lo que fallaste, explora el banco completo o haz una prueba
              cronometrada.
            </p>
            <dl>
              <div>
                <dt>Práctica</dt>
                <dd>Elige una parte, un dominio o una destreza y empieza.</dd>
              </div>
              <div>
                <dt>Repaso</dt>
                <dd>
                  Vuelve a tus errores, a lo que dejaste sin contestar y a tus
                  marcadores.
                </dd>
              </div>
              <div>
                <dt>Explorar</dt>
                <dd>Busca y abre preguntas una por una.</dd>
              </div>
              <div>
                <dt>Modo de prueba</dt>
                <dd>
                  Una prueba con las partes de la PAA, cada una con su reloj.
                </dd>
              </div>
            </dl>
          </section>
          <details>
            <summary>Modo de prueba</summary>
            <p>
              Sigue la prueba real tan de cerca como se sabe: las partes van en
              orden (Lectura y Redacción, Matemáticas, Inglés), cada una con su
              propio reloj. Eliges las partes, cuántas preguntas y el tiempo de
              cada una, o puedes quitar el límite.
            </p>
            <p>
              Dentro de una parte puedes saltar preguntas, volver y marcarlas
              para revisar; el botón Resumen muestra cuáles has contestado y es
              desde donde terminas la parte. Al terminarla (tú o el reloj) ya no
              puedes volver a ella, y entre una parte y otra puedes descansar:
              el siguiente reloj no corre hasta que lo empieces.
            </p>
            <p>
              No ves si acertaste hasta el final, y no hay penalidad por
              contestar mal: contesta todas. Si sales, el reloj de la parte se
              detiene (la prueba real no tiene pausa). Al terminar, los
              resultados se muestran por parte, dominio y destreza, y todas las
              preguntas se pueden revisar; las pruebas están en Modo de prueba,
              donde puedes renombrarlas o borrarlas.
            </p>
          </details>
          <details>
            <summary>Lecturas y preguntas relacionadas</summary>
            <p>
              Las preguntas que comparten una lectura se agrupan y siguen su
              orden original. Algunas preguntas de «mejor evidencia» citan la
              pregunta anterior, que se muestra junto a la pregunta.
            </p>
          </details>
          <details>
            <summary>Respuestas numéricas</summary>
            <p>
              En Matemáticas, algunas preguntas piden escribir la respuesta.
              Debe ser un número positivo (entero, fracción o decimal), de hasta
              4 caracteres, sin números mixtos. Un decimal se acepta si es
              exacto o si tiene al menos tres cifras y es el valor correcto
              truncado o redondeado: para 2/3 valen .666 y .667, pero no .66 ni
              .67.
            </p>
          </details>
          <details>
            <summary>Tu progreso</summary>
            <p>
              El portal muestra el porcentaje de respuestas correctas por parte,
              dominio y destreza. No es una puntuación de la PAA: la prueba
              oficial convierte las respuestas correctas de la prueba completa a
              una escala de 200 a 800, y no se ha publicado una tabla para hacer
              esa conversión por tu cuenta. Por eso aquí no hay una puntuación
              estimada.
            </p>
          </details>
          <details>
            <summary>Atajos de teclado</summary>
            <ShortcutHelp />
          </details>
          <details>
            <summary>Tus datos</summary>
            <p>
              Todo se guarda en este navegador y funciona sin conexión. En
              Ajustes puedes agregar tus PDF de preguntas, reiniciar el progreso
              de la PAA o quitar las preguntas. El progreso del SAT y el de la
              PAA se guardan por separado.
            </p>
          </details>
        </div>
      </dialog>
    </>
  );
}

function SatHelp() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [openSection, setOpenSection] = useState<string>();
  const close = () => {
    setOpenSection(undefined);
    dialog.current?.close();
  };
  const detail = (key: string) => ({
    onClick: (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      setOpenSection((current) => (current === key ? undefined : key));
    },
  });
  return (
    <>
      <button
        ref={trigger}
        className="text-button help-link"
        aria-label="Help and keyboard shortcuts"
        onClick={() => {
          setOpenSection(undefined);
          dialog.current?.showModal();
        }}
      >
        Help
      </button>
      <dialog
        ref={dialog}
        className="practice-dialog help-dialog"
        aria-labelledby="help-title"
        onClose={() => {
          setOpenSection(undefined);
          trigger.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="dialog-heading">
          <h2 id="help-title">Using SAT Study</h2>
          <button aria-label="Close help" onClick={close}>
            ×
          </button>
        </div>
        <div className="help-content">
          <section className="help-overview" aria-label="SAT Study overview">
            <p>
              SAT Study has four main areas. Start a focused set, return to past
              work, inspect the library, or take a test.
            </p>
            <dl>
              <div>
                <dt>Practice</dt>
                <dd>Work through a focused study session.</dd>
              </div>
              <div>
                <dt>Review</dt>
                <dd>Revisit attempts and saved questions.</dd>
              </div>
              <div>
                <dt>Browse</dt>
                <dd>Search and inspect the question library.</dd>
              </div>
              <div>
                <dt>Tests</dt>
                <dd>Run timed or untimed test modules.</dd>
              </div>
            </dl>
          </section>
          <details open={openSection === "practice"}>
            <summary {...detail("practice")}>Practice</summary>
            <p>
              Practice creates focused, shuffled study sessions from your
              filters. Answers receive feedback as you work. Exit saves your
              place, drafts, timing, question order, and calculator workspace so
              an unfinished session can resume later.
            </p>
          </details>
          <details open={openSection === "review"}>
            <summary {...detail("review")}>Review</summary>
            <p>
              Review summarizes submitted attempts and keeps repeated attempts
              separate. Mistakes, unanswered assigned questions, completed
              questions, and ordinary bookmarks can become new Practice sets.
              Accuracy excludes unanswered questions.
            </p>
            <p>
              Bookmarks are persistent study markers, not answers. They remain
              available after the normal progress reset unless you explicitly
              choose to clear them.
            </p>
          </details>
          <details open={openSection === "browse"}>
            <summary {...detail("browse")}>Browse</summary>
            <p>
              Browse searches the library and opens individual questions without
              creating a session or recording an answer. You can add or remove
              an ordinary bookmark while inspecting a question.
            </p>
          </details>
          <details open={openSection === "tests"}>
            <summary {...detail("tests")}>Tests</summary>
            <p>
              Choose a Full Test or one module. Timed modules count down;
              untimed modules use an unlimited stopwatch. A live module can be
              paused and resumed, including after closing the portal. The
              Question Overview shows answered and unanswered questions.
              <strong> Mark for Review</strong> is only a live-test aid and is
              cleared when that module is completed.
            </p>
            <p>
              Full Tests route each Higher or Lower Module 2 from scored Module
              1 performance and include an automatic, skippable break before
              Math. Every module contains two portal-simulated unscored
              questions; this does not identify real SAT pretest questions.
              Results exclude those simulated items and delay answer feedback
              until the test is complete.
            </p>
            <p>
              Starting a Practice Test exposes its active questions, and the
              portal does not reuse them for another Practice Test. Deleting a
              result does not reset that exposure history; resetting study
              progress does.
            </p>
          </details>
          <details open={openSection === "protection"}>
            <summary {...detail("protection")}>
              Protect active questions
            </summary>
            <p>
              Active questions may belong to current or future official Bluebook
              practice material. With protection enabled, ordinary Practice
              hides them by default; Tests intentionally use active questions.
              Disabling protection can expose them in ordinary Practice.
            </p>
            <p>
              Inactive questions remain available. Unknown status stays explicit
              and is not a promise that a question is spoiler-safe. The portal
              does not know which questions are unscored on the real SAT.
            </p>
          </details>
          <details open={openSection === "sessions"}>
            <summary {...detail("sessions")}>
              Sessions, bookmarks, and filters
            </summary>
            <p>
              Resuming a session preserves its saved order and place. Session
              names and stars organize sets; they are separate from ordinary
              question bookmarks. Answer-status filters use the latest submitted
              answer, while Review keeps earlier attempts in history. An empty
              status selection means all statuses.
            </p>
            <dl className="help-definitions">
              <dt>Unanswered</dt>
              <dd>
                In Practice, no recorded answer. In Review, assigned to a
                session but still without a recorded answer.
              </dd>
              <dt>Mistakes</dt>
              <dd>Questions whose latest recorded answer is incorrect.</dd>
              <dt>Completed</dt>
              <dd>Questions with at least one submitted answer.</dd>
            </dl>
            <p>
              Section sets the broad SAT scope. Domains are limited to that
              scope, and skills are limited to the selected domains. With All
              selected, a domain can narrow the scope on its own.
            </p>
          </details>
          <details open={openSection === "calculator"}>
            <summary {...detail("calculator")}>Calculator</summary>
            <p>
              The calculator is available during Practice and Tests and can be
              reopened from completed Math results. It works without internet,
              and its work saves with the session.
            </p>
          </details>
          <details open={openSection === "questions"}>
            <summary {...detail("questions")}>
              Adding questions and resetting progress
            </summary>
            <p>
              Add your questions in Settings under Add your question PDFs.
              Choose the four PDF exports; they are read in this browser, never
              uploaded, and the whole set takes about 5 to 10 minutes. Active
              questions are marked automatically from the files and stay hidden
              by default.
            </p>
            <p>
              Reset study progress clears attempts, sessions, and Practice Test
              exposure so test questions become eligible again. It preserves the
              library, settings, and bookmarks unless you explicitly clear
              bookmarks, and keeps one local recovery snapshot of the previous
              study state.
            </p>
            <p>
              Free up space in Settings removes your questions (answers and
              bookmarks stay) or erases everything this site keeps on the
              device. Your original PDFs are never touched.
            </p>
          </details>
          <details open={openSection === "shortcuts"}>
            <summary {...detail("shortcuts")}>Keyboard shortcuts</summary>
            <ShortcutHelp />
          </details>
        </div>
      </dialog>
    </>
  );
}
