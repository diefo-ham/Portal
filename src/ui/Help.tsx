import { useRef, useState, type MouseEvent } from "react";

export function ShortcutHelp() {
  return (
    <div className="shortcut-help">
      <dl>
        <dt>← / →</dt>
        <dd>Previous / next question</dd>
        <dt>1–4</dt>
        <dd>Choose answer A–D (letters also work while reading)</dd>
        <dt>Enter / Space</dt>
        <dd>
          Check your answer; after feedback, advance or review the session
        </dd>
        <dt>E</dt>
        <dd>Toggle the current question’s bookmark</dd>
        <dt>Escape</dt>
        <dd>Close a panel or dialog</dd>
      </dl>
      <p className="small muted">
        Shortcuts apply while reading. Focused controls keep their normal keys;
        Enter also submits a selected answer choice or numeric answer. Use Tab
        to reach controls and Space to activate them.
      </p>
      <p className="small muted">
        Exit saves your place. Resume any unfinished set from Practice. Find
        saved questions in Review → Bookmarks. The question number opens the
        session map. Practice tools contain timing and question details.
      </p>
    </div>
  );
}

export function Help() {
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
          <section>
            <h3>Practice and Browse</h3>
            <p>
              <strong>Practice</strong> creates and resumes study sessions.
              <strong> Browse</strong> lets you search the library and inspect
              individual questions without starting a session.
            </p>
          </section>
          <details open={openSection === "protection"}>
            <summary {...detail("protection")}>
              Practice-test question protection
            </summary>
            <p>
              Some imported questions may belong to active practice tests.
              Protection hides those questions during ordinary study so you do
              not accidentally spoil a future test. Inactive questions remain
              available. Questions with unknown status also remain available
              because the portal cannot confidently identify them as active.
            </p>
            <p>
              Turning protection off makes active questions eligible again. The
              portal asks for confirmation before opening or starting a set that
              contains one.
            </p>
          </details>
          <details open={openSection === "status"}>
            <summary {...detail("status")}>Answer status</summary>
            <p>
              Choose one or more statuses; an empty selection means all
              questions. Status reflects the latest submitted answer, while
              earlier attempts remain in history.
            </p>
            <dl className="help-definitions">
              <dt>All</dt>
              <dd>No answer-status restriction.</dd>
              <dt>Unanswered</dt>
              <dd>
                In Practice filters, questions with no recorded answer. In
                Review, only questions previously assigned to a session and
                still without a recorded answer.
              </dd>
              <dt>Mistakes</dt>
              <dd>Questions whose latest recorded answer is incorrect.</dd>
              <dt>Completed</dt>
              <dd>Questions with at least one submitted answer.</dd>
            </dl>
          </details>
          <details open={openSection === "taxonomy"}>
            <summary {...detail("taxonomy")}>
              Section, domain, and skill
            </summary>
            <p>
              Section sets the broad SAT scope. Domains are limited to that
              scope, and skills are limited to the selected domains. With All
              selected, a domain can narrow the scope on its own.
            </p>
          </details>
          <details open={openSection === "sessions"}>
            <summary {...detail("sessions")}>
              Sessions and saved questions
            </summary>
            <p>
              New sessions are shuffled; resuming preserves the saved order and
              your place. Session stars keep important sets easy to find and are
              separate from question bookmarks. Bookmarks are available from
              Review and do not count as answers.
            </p>
            <p>
              Review accuracy uses correct submitted attempts divided by all
              submitted attempts in the selected scope. Unanswered questions are
              excluded, and repeated attempts remain separate.
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
