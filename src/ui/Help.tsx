import { useRef, useState, type MouseEvent } from "react";
import { assessmentInfo } from "../core/assessments";
import { useAssessment, useT } from "./i18n";

export const ShortcutHelp = () => {
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
};

export const Help = () => {
  const assessment = useAssessment();
  return assessment === "PAA" ? (
    <PaaHelp />
  ) : assessment === "TSI" ? (
    <TsiHelp />
  ) : (
    <SatHelp />
  );
};

function TsiHelp() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => dialog.current?.close();
  return (
    <>
      <button
        ref={trigger}
        className="text-button help-link"
        aria-label="Help and keyboard shortcuts"
        onClick={() => dialog.current?.showModal()}
      >
        Help
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
          <h2 id="help-title">Using TSI Study</h2>
          <button aria-label="Close help" onClick={close}>
            ×
          </button>
        </div>
        <div className="help-content">
          <section className="help-overview" aria-label="TSI Study overview">
            <p>
              TSI Study practises the two tests of the TSIA2, ELAR (reading and
              writing together) and Mathematics. Start a focused set, return to
              what you missed, or browse the whole bank. There is no clock and
              no score: you work at your own pace.
            </p>
            <dl>
              <div>
                <dt>Practice</dt>
                <dd>Choose a test, a domain or a skill, and begin.</dd>
              </div>
              <div>
                <dt>Review</dt>
                <dd>
                  Return to your mistakes, what you left unanswered, and your
                  bookmarks.
                </dd>
              </div>
              <div>
                <dt>Browse</dt>
                <dd>Search and open questions one at a time.</dd>
              </div>
            </dl>
          </section>
          <details>
            <summary>Official and original questions</summary>
            <p>
              Some questions are College Board sample questions (Official) and
              the rest were written for this portal (Original); Browse shows
              which. In Settings, &ldquo;Include original questions&rdquo; turns
              the original ones off and on without deleting anything. Sessions
              that contain them stay, without those questions.
            </p>
          </details>
          <details>
            <summary>Reading sets</summary>
            <p>
              Reading questions that share a passage are kept together, in their
              original order. Paired passages and numbered sentences are shown
              as printed, and in sentence questions the underlined part stays
              underlined.
            </p>
          </details>
          <details>
            <summary>Calculators</summary>
            <p>
              The real TSIA2 gives one on-screen calculator for each Math
              question: Basic (add, subtract, multiply, divide), Square root
              (the same, plus a square-root key) or Graphing. This portal does
              the same: the chip beside the domain names the calculator for that
              question, and the Calculator button (or the \ key) opens it. They
              are modelled on the features College Board describes, not copied
              from its software; the Basic and Square-root ones carry out each
              operation as you press the next, like a pocket calculator.
            </p>
          </details>
          <details>
            <summary>Your progress</summary>
            <p>
              The portal shows the percent of answers you got right, by test,
              domain and skill. It does not show a TSI score or a pass or fail:
              the real TSIA2 adapts to each student and College Board publishes
              no way to convert practice answers into a score.
            </p>
          </details>
          <details>
            <summary>Keyboard shortcuts</summary>
            <ShortcutHelp />
          </details>
          <details>
            <summary>Your data</summary>
            <p>
              Everything is stored in this browser and works offline. A fresh
              install comes with original example questions for each test; the
              Tests tab opens once you have added question PDFs of your own. In
              Settings you can add your question PDFs, reset TSI progress or
              remove your questions (the examples stay). SAT, PAA and TSI
              progress are kept separately.
            </p>
          </details>
        </div>
      </dialog>
    </>
  );
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
              Todo se guarda en este navegador y funciona sin conexión. Una
              instalación nueva trae preguntas de ejemplo originales para cada
              prueba; el Modo de prueba se abre cuando hayas agregado PDF de
              preguntas propios. En Ajustes puedes agregar tus PDF de preguntas,
              reiniciar el progreso de la PAA o quitar tus preguntas (las de
              ejemplo se quedan). El progreso del SAT y el de la PAA se guardan
              por separado.
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
              The example questions that come with the portal are for studying
              in Browse, Practice and Review. Tests are built from your own
              question PDFs, so this page opens once you have added some.
            </p>
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
              This setting, and the matching filter in Practice and Browse,
              appear once you have added SAT questions of your own: the example
              questions that come with the portal have no active or inactive
              status, so there is nothing to protect.
            </p>
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
              Choose Add your question PDFs and drop your SAT, PAA and TSI PDFs
              into the window that opens. File names do not matter: each PDF is
              sorted by the test named inside it, and only pages that carry the
              access code for that test are added. They are read in this browser
              and never uploaded; the SAT PDF is large and can take 10 minutes
              or more. Each SAT question is marked active or inactive by the
              badge on its page, and active questions stay hidden by default.
              Settings lists every PDF you added and lets you remove one.
            </p>
            <p>
              Once a test has questions of your own, its example questions are
              hidden. Include example questions in Settings brings them back;
              nothing is deleted either way.
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
