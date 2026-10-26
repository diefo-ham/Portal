# Focused practice milestone — Stages 1 and 2

Implemented on `codex/focused-practice`, starting from the unchanged checkpoint `0f92e81`.

## Scope

- Practice is the default destination. The existing session setup has section/domain controls, optional advanced filters, and session length. The individual-question list is in Browse.
- Review retains its existing statistics, mistake filters, and session history. Results retain their existing structure.
- Settings is a quiet gear button. Import, backup, restore, import history, and storage details remain available inside Library & maintenance.
- During practice, the global header disappears. The question is centered; overview, notes, timer controls, and source metadata use an accessible native dialog with Escape dismissal and focus restoration.
- Bookmark and note icons stay beside the question. Notes with existing content have a visible dot. Source-format clarification warnings remain visible because they affect interpreting a question.
- Math has a separate calculator panel. It opens beside the question, can be resized on a laptop, stacks beneath it on narrow screens, and retains values across consecutive Math questions. The existing arithmetic provider is unchanged.
- Before submission, Check answer is primary and skipping is secondary. After submission, Next becomes primary and receives keyboard focus. Navigation resets reading position. Correct/incorrect feedback uses restrained transitions and honors reduced motion.

## Decisions

The full Home composer and Results redesign are deferred. Home reuses the existing visual components with progressively disclosed filters; it is an interim navigation destination, not the final Stage 3 design. Typography, palette, PDF image presentation, and the full theme system remain for later work.

Practice-test protection defaults on and is stored under `sat-protect-tests` in localStorage, separately from study records. Advanced filters can temporarily override it. A session containing active questions asks for confirmation once at creation. Resuming an existing session does not repeat that confirmation. Unknown status remains available and is explained in Settings.

The timer is hidden by default but records the same foreground time as before. The tools panel can reveal or pause it; a paused session shows a contextual indicator. Leaving practice unmounts the timer and flushes elapsed time. Timer visibility and open tools are temporary presentation state, while manual pause state continues to use the existing session record.

Existing IndexedDB schema, imported questions, images, answers, notes, bookmarks, backup format, scoring, and session rules are unchanged. No data migration is required. All prepared-library loading remains automatic.

## Verification

- Production TypeScript/Vite build and 12 core/storage tests pass.
- Seven Edge browser tests cover existing offline workflows, reload/browser-restart persistence, migration, PDF image/answer separation, portable backup restore, contextual tools, drafts, calculator state, keyboard flow, focus restoration, narrow layouts, and persisted active-question protection.
- Private-corpus QA imported all 3,770 questions and 7,731 images into an isolated browser context, practiced representative numeric/choice Math and Reading & Writing questions, checked explanations and reload persistence, and blocked every non-loopback request. No browser errors.
- Visually inspected the updated actual PDF practice views. Real question screenshots remain ignored private data.
