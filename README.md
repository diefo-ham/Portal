# SAT Study

A private, local-first SAT practice workspace. The application bundles **only original synthetic questions**. It does not scrape College Board, redistribute its question bank, or send study data anywhere.

## Run on this laptop

The app has been installed and built. Double-click **Start SAT Study.cmd**, or run:

```powershell
npm.cmd start
```

Open **http://127.0.0.1:4317** in your usual browser. Keep the server terminal open. Use this exact address and the same browser profile each time; `localhost`, different ports, private windows, and the Codex preview have separate storage. If a browser opens before the server starts, refresh once.

For a fresh checkout, install Node.js 22.12+ (Node 24 recommended), then:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd start
```

Dependency installation requires internet once. The built app and local server do not. `npm start` uses Node's built-in HTTP server and binds only to `127.0.0.1`. It serves built app assets and the explicitly prepared library under `/local-library/`; source PDFs, caches, and other repository files are not served. Stop it with Ctrl+C. Port conflicts produce an error rather than silently changing your storage origin.

For frontend changes, stop the production server and run `npm.cmd run dev` at the same origin. Rebuild before using `npm start` again.

## First session

1. Your prepared PDF library loads automatically on first launch in a browser profile. Allow the local image-import progress to finish. If no prepared library exists, **Load synthetic sample** provides 12 original examples.
2. On **Practice**, choose a section, any combination of domains, and a simple answer status: All questions, Unanswered, Mistakes, or Completed. **Refine selection** reveals a skill multi-select, difficulty, bookmarks, and one practice-test protection checkbox. Selections within each dropdown are combined with OR; domain and skill filters combine with AND. An empty selection means any. Changing the section clears its scoped selections; changing domains removes skills that no longer fit.
3. Start a session of 5, 10, 20, or all matching questions. The whole filtered pool is shuffled before selecting the requested size; answer-choice order is unchanged. An immediate identical order is avoided when the set contains multiple questions. The selected order is saved once and stays fixed when resuming. **Browse** retains the complete searchable library and individual-question access. A new session ends the previous one while retaining its submitted answers.
4. Choose an answer and **Check answer**, then read the explanation and continue. A–D selects a choice. While reading the question, Enter or Space performs the primary action: check the answer, advance after feedback, or review the last question. Left/Right move to the previous/next question without submitting; Right on the final question does nothing. Focused controls retain normal Space/arrow behavior (radio choices, text carets, calculator inputs, and checkboxes). Focused buttons retain their normal Enter/Space action. Numeric entries also support Enter to submit. Numeric questions accept equivalent decimal/fraction values.
5. The star bookmarks a question. Click the question count for an overview, or **•••** for timing, question details, and early completion. Timing is collected quietly and stops when you leave practice or switch tabs. The Math calculator opens alongside the question and retains its working values across consecutive Math questions. Notes are no longer part of the interface.
6. Results show correct, incorrect, and unanswered counts, with accuracy calculated only over submitted answers. Retry the entire session, its mistakes, or its unanswered questions as a new shuffled set. Original outcomes stay intact. **Review** provides latest-mistake and unanswered queues, contextual skills to revisit, and reusable history (Show older sessions reveals more). The unanswered queue contains questions assigned to a practice set that have never received a submitted answer, rather than the whole unseen bank. A later answer resolves a global unanswered item without rewriting older session results.
7. The **Settings icon** sits beside Browse as a quieter navigation item. Practice-test protection is a local preference; the Home/Browse checkbox can override it for a selection. Active questions are hidden while protection is on; unknown metadata is included and remains explicit in question details. Starting any set containing active questions, including a historical retry, asks once for confirmation. Global Review queues follow the Settings preference. **Library & maintenance** is directly visible on Settings, without an additional expansion toggle, and contains import, backup, restore, and storage tools. Restore still validates and confirms before replacing data.
8. **Settings → Library & maintenance → Reset study progress** opens a simple confirmation with **Also clear bookmarks** unchecked. Confirming clears all attempts, sessions (completed and unfinished, including drafts and timing), and legacy notes. Bookmarks are retained unless explicitly selected for clearing. Questions, PDF images, import records, and interface preferences are preserved. Accuracy/mistake summaries return to empty because they are derived from those records. Cancel or Escape changes nothing; export a backup first if you want to recover prior progress later.

Stage 3 adds focused Home and Results/Review layouts to the earlier practice redesign. The full visual system and automatic light/dark themes remain deferred to Stage 4. See [Stage 3 decisions and verification](docs/stage3.md) and [earlier milestone notes](docs/practice-redesign.md).

## Technology and storage

- React 19, TypeScript, Vite; plain CSS and locally available system fonts. No UI framework, CDN, authentication, analytics service, remote API, or hosted database.
- IndexedDB database **`sat-study-local`**, version 2, in the browser profile for `http://127.0.0.1:4317`. The `state` store retains the versioned question/progress snapshot under `current`; the `assets` store holds immutable PDF images as separate Blobs. Existing version-1 data migrates automatically.
- Questions, import provenance, every submitted attempt, bookmarks, session membership, drafts, and elapsed time persist. The legacy annotation `note` field remains dormant for compatibility with stored data and older backups; there is no note editing/display UI. Existing legacy notes remain in backups until progress is reset. Mutations are atomic IndexedDB transactions, and failed writes show an error.
- Browser data lives outside this repository and is not automatically synchronized or included in Git. Browser cleanup, profile deletion, or eviction can remove it. Full JSON backups include imported question content: keep them private.
- Use one study tab at a time. Transactions preserve concurrent changes, but live cross-tab UI synchronization is not implemented.
- Timers count foreground question time, can be paused, stop after submission, and checkpoint every five seconds and on navigation. A sudden process kill can lose up to roughly five seconds of timing; submitted answers and bookmarks are committed immediately. Timers do not count time while the app is closed. This is not a timed test simulator.

## Architecture

| Location                     | Responsibility                                                       |
| ---------------------------- | -------------------------------------------------------------------- |
| `src/core/model.ts`          | Central question, attempt, annotation, session, and filter types     |
| `src/core/practice.ts`       | Pure scoring, filtering, session creation, and analytics             |
| `src/core/commands.ts`       | Session lifecycle and validated, idempotent answer submissions       |
| `src/core/taxonomy.ts`       | Scoped metadata identity and conservative label grouping            |
| `src/core/review.ts`         | Session outcomes and global mistake/unanswered queues                |
| `src/importing/json.ts`      | Untrusted JSON validation and conservative duplicate handling        |
| `src/importing/backup.ts`    | Full-state backup validation and download                            |
| `src/storage/database.ts`    | IndexedDB connection and atomic read-modify-write operations         |
| `src/ui/`                    | Screens, components, presentation state, and styles                  |
| `src/ui/useQuestionTimer.ts` | Foreground timing and persistence checkpoints, independent of layout |
| `src/calculator/`            | Replaceable calculator panel; no storage or question-rule coupling   |
| `src/data/synthetic.json`    | Original examples, also downloadable inside the app                  |
| `scripts/serve.mjs`          | Dependency-free production server for built local assets             |

Parsing, normalized data, persistence, and presentation are separate. The PDF preparation utility emits normalized JSON and local image assets; it never writes browser progress. See [PDF import instructions and classification](docs/pdf-import.md), [question format](docs/question-format.md), and [calculator investigation](docs/calculator.md). Durable product principles are in [AGENTS.md](AGENTS.md).

Question metadata and progress remain in a versioned snapshot. Large PDF image content is stored separately, so it is not rewritten when answers, bookmarks, or timers save. Full backups embed those images and can be large. For very long histories, separate question/attempt stores and indexes remain a possible future optimization. The application deliberately exposes one resumable session: beginning a new session marks the old one finished while retaining its submitted answers and history. Supporting multiple open sessions is possible with the existing records but would need a session-selection interface.

## Verification

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run test:e2e
```

Unit tests cover numeric equivalence, filtering, duplicate/import safety, backup validation, transaction concurrency, and rollback. Browser tests use installed Microsoft Edge, launch a temporary local production server, and exercise answering, explanations, filtering, bookmarks, keyboard behavior, reset options, reload persistence, backups, malformed imports, responsive overflow, and a workflow with all non-loopback requests blocked. For other machines, install Edge or change `channel` in `playwright.config.ts` to an available Playwright browser.

## Current limits and next steps

1. **Real exports:** The supplied PDF exports are prepared locally with metadata, source IDs, answer keys, and original-layout question/explanation images. The parser targets this specific export layout; arbitrary PDFs are not accepted directly by the browser. Search text is approximate and may omit math notation. Semantic math and full screen-reader transcription remain future work.
2. **Active comparison:** These exports were confirmed by the user to be separate active-only and inactive sets. The preparation utility also supports inclusive/exclusive comparisons with source IDs and flags inconsistent sets; uncertain matches remain unknown. New export modes must be stated explicitly.
3. **Calculator:** Offline arithmetic is available. Graphing needs a licensed offline Desmos integration or a separately assessed local graphing engine. No public Desmos website is embedded or copied.
4. **Analytics:** Accuracy includes all attempts, not predicted SAT scores. Latest-answer status and ever-missed history are distinct. Timing is approximate, untimed practice only. Expand metrics only when the records support them.
5. **GUI:** The current academic layout is a starting point. Iterate on `src/ui` and `src/calculator` while preserving tested import, scoring, and storage rules. Add a meaningful regression test when a behavioral edge case is fixed.
6. **Packaging:** The local server must be running. There is no service worker, PWA installation, executable bundle, or cloud deployment. A desktop wrapper can reuse the same core and swap the persistence adapter later.

This project is not affiliated with or endorsed by College Board. SAT and Bluebook are their respective owners' marks.
