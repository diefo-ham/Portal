import { useRef } from "react";

export function ShortcutHelp() {
  return (
    <div className="shortcut-help">
      <dl>
        <dt>← / →</dt>
        <dd>Previous / next question</dd>
        <dt>1–4</dt>
        <dd>Choose answer A–D (A, C, and D also work while reading)</dd>
        <dt>Enter / Space</dt>
        <dd>
          Check your answer; after feedback, advance or review the session
        </dd>
        <dt>B</dt>
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
  return (
    <>
      <button
        ref={trigger}
        className="text-button help-link"
        aria-label="Help and keyboard shortcuts"
        onClick={() => dialog.current?.showModal()}
      >
        ? <span>Help</span>
      </button>
      <dialog
        ref={dialog}
        className="practice-dialog"
        aria-labelledby="help-title"
        onClose={() => trigger.current?.focus()}
      >
        <div className="dialog-heading">
          <h2 id="help-title">Using SAT Study</h2>
          <button
            aria-label="Close help"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <ShortcutHelp />
      </dialog>
    </>
  );
}
