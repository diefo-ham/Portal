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

## Behavioral follow-up

The original MVP and pre-redesign checkpoint both selected the first matching questions in library order; randomization was absent, not removed by the redesign. New generated sessions now shuffle the full eligible pool with Fisher–Yates before applying the session size. A match to the immediately preceding saved order swaps the first two questions when possible. Single-question Browse access stays intentional. Answer choices are never reordered, and existing/resumed sessions are never shuffled. Mistake retries shuffle only the supplied missed-question IDs. The active-question confirmation checks the selected set before it is committed.

Settings → Library & maintenance has a confirmed Reset study progress action. It atomically empties attempts, sessions, and annotations. Sessions include all saved drafts, timing, pause state, navigation position, and resumable/completed history; annotations include every note and bookmark. Derived analytics and mistake filters consequently return to an empty state. Questions, image assets, import receipts, application files, and interface preferences are preserved. Temporary progress-specific filters and restore previews are cleared after a successful reset. Cancelling the confirmation performs no mutation. No schema migration is involved.

Focused regression review found an accidental keyboard regression: the shortcut handler ignored focused radio controls, and draft saves temporarily disabled the fieldset, dropping focus. Choice drafts now save without disabling controls; A–D and Enter work after a pointer selection as well. Submission remains guarded and transactionally ordered. Existing numeric entry, annotations, calculator, timing controls, question overview, backups, imports, and saved-session behavior remain covered by browser tests. No additional product choices or Stage 3 changes were made.

Follow-up verification: production build, 15 core/storage tests, and nine browser tests. Added coverage includes shuffle-before-limit, duplicate-free selection, repeat avoidance, exact saved-order/index resumption, reset cancellation/confirmation, completed and unfinished record removal, preference/import/corpus preservation, and continued PDF-image practice after reset and reload. Browser tests that assert particular synthetic question content fix their random source explicitly; the session-generation browser test uses production randomness.

## Verification

- Production TypeScript/Vite build and 12 core/storage tests pass.
- Seven Edge browser tests cover existing offline workflows, reload/browser-restart persistence, migration, PDF image/answer separation, portable backup restore, contextual tools, drafts, calculator state, keyboard flow, focus restoration, narrow layouts, and persisted active-question protection.
- Private-corpus QA imported all 3,770 questions and 7,731 images into an isolated browser context, practiced representative numeric/choice Math and Reading & Writing questions, checked explanations and reload persistence, and blocked every non-loopback request. No browser errors.
- Visually inspected the updated actual PDF practice views. Real question screenshots remain ignored private data.
