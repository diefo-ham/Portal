import { useEffect, useRef, useState } from "react";
import type { Session, StudyData } from "../core/model";
import { sessionOutcomes } from "../core/review";
import { SESSION_NAME_MAX_LENGTH, sessionDisplayName } from "../core/sessions";

export function SessionRow({
  data,
  session,
  onOpen,
  onRename,
  onDelete,
  onToggleStar,
  onRepractice,
}: {
  data: StudyData;
  session: Session;
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onToggleStar: (id: string) => void;
  onRepractice?: (session: Session) => void;
}) {
  const label = sessionDisplayName(data, session);
  const result = sessionOutcomes(data, session);
  const answered = result.correct.length + result.incorrect.length;
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(session.name || label);
  const root = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const renameInput = useRef<HTMLInputElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const deleteCancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  useEffect(() => {
    if (renaming) renameInput.current?.select();
  }, [renaming]);

  const finishRename = () => {
    onRename(session.id, draft);
    setRenaming(false);
    queueMicrotask(() => menuButton.current?.focus());
  };

  return (
    <div
      className={`study-session-row ${session.finishedAt ? "completed" : "unfinished"}`}
      ref={root}
    >
      <button
        className="session-row-open"
        onClick={() => onOpen(session.id)}
        aria-label={`${session.finishedAt ? "Open session results" : "Resume practice"}: ${label}`}
      >
        <span className="session-row-name">{label}</span>
        <span className="session-row-meta">
          {session.finishedAt
            ? `${answered ? `${result.correct.length} of ${answered} answered correctly` : `${result.unanswered.length} unanswered`} · completed ${new Date(session.finishedAt).toLocaleDateString()}`
            : `${answered} answered · ${result.unanswered.length} left · started ${new Date(session.startedAt).toLocaleString()}`}
        </span>
      </button>
      <button
        className={`session-star ${session.starred ? "selected" : ""}`}
        aria-pressed={!!session.starred}
        aria-label={`${session.starred ? "Unstar" : "Star"} session ${label}`}
        title={session.starred ? "Unstar session" : "Star session"}
        onClick={() => onToggleStar(session.id)}
      >
        {session.starred ? "★" : "☆"}
      </button>
      <div className="session-action-wrap">
        <button
          ref={menuButton}
          className="session-menu-trigger"
          aria-label={`Session actions for ${label}`}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setMenuOpen(false);
          }}
        >
          •••
        </button>
        {menuOpen && (
          <div
            className="session-menu"
            role="menu"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setMenuOpen(false);
                menuButton.current?.focus();
              }
            }}
          >
            <button
              role="menuitem"
              onClick={() => {
                setDraft(session.name || label);
                setMenuOpen(false);
                setRenaming(true);
              }}
            >
              Rename
            </button>
            {session.finishedAt && onRepractice && (
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onRepractice(session);
                }}
              >
                Practice again
              </button>
            )}
            <button
              className="danger"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                deleteDialog.current?.showModal();
                deleteCancel.current?.focus();
              }}
            >
              Delete session
            </button>
          </div>
        )}
      </div>
      {renaming && (
        <div
          className="session-rename"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setRenaming(false);
              menuButton.current?.focus();
            }
          }}
        >
          <label>
            <span className="sr-only">Session name</span>
            <input
              ref={renameInput}
              aria-label="Session name"
              maxLength={SESSION_NAME_MAX_LENGTH}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  finishRename();
                }
              }}
            />
          </label>
          <button onClick={finishRename}>Save</button>
          <button
            className="text-button"
            onClick={() => {
              setRenaming(false);
              menuButton.current?.focus();
            }}
          >
            Cancel
          </button>
          <span className="small muted">
            Clear the name to use the automatic label.
          </span>
        </div>
      )}
      <dialog
        ref={deleteDialog}
        className="practice-dialog session-delete-dialog"
        aria-labelledby={`delete-session-${session.id}`}
      >
        <h2 id={`delete-session-${session.id}`}>Delete this session?</h2>
        <p>
          Delete “{label}”? Your answers and bookmarks will stay in your study
          history.
        </p>
        <div className="row reset-actions">
          <button
            ref={deleteCancel}
            onClick={() => deleteDialog.current?.close()}
          >
            Cancel
          </button>
          <button
            className="danger"
            onClick={() => {
              deleteDialog.current?.close();
              onDelete(session.id);
            }}
          >
            Delete session
          </button>
        </div>
      </dialog>
    </div>
  );
}
