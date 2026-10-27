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
3. Enter any whole-number session size from 1 through the displayed maximum. If filters reduce the available pool below the entered number, the new maximum appears and Start stays unavailable until the number is valid. The whole filtered pool is shuffled before selecting the requested size; answer-choice order is unchanged. An immediate identical order is avoided when the set contains multiple questions. The selected order is saved once and stays fixed when resuming. **Browse** is a separate searchable question reader: it opens individual questions, supports bookmarking and previous/next movement through the current matches, and never creates or resumes sessions. Starting a new set from Practice leaves other unfinished sessions available in the **Continue** area, with a derived section/focus/count label, answered/remaining counts, and start time. A session can be renamed (80 Unicode characters, trimmed) or quietly starred from its contextual controls. Completed starred and recent sessions remain in Practice, with a searchable **View all sessions** disclosure. Each session retains its own order, position, drafts, timing, name, and star state.
4. Choose an answer and **Check answer**, then continue. 1–4 and A–D select their matching choices while reading. While reading the question, Enter or Space performs the primary action: check the answer, advance after feedback, or review the last question. Left/Right move to the previous/next question without submitting; Right on the final question does nothing. Focused controls retain normal Space/arrow behavior (radio choices, text carets, calculator inputs, and checkboxes). Focused buttons retain their normal Enter/Space action. Numeric entries also support Enter to submit. Numeric questions accept equivalent decimal/fraction values. Correct answers show concise confirmation by default with an optional **View explanation** disclosure; Settings can restore automatic explanations. Incorrect answers always show their explanation.
5. The star or **E** bookmarks a question; B remains available for answer choice B. A mouse click on the Practice star returns focus to the reading surface; keyboard activation retains button focus. Browse also allows bookmarking without recording an answer or creating a session. **Review → Bookmarks → Practice bookmarks** starts a shuffled set of saved questions while respecting practice-test protection. The bookmarked-only filter remains in Browse and Refine selection. **Help** in the main navigation, and **Practice tools → Keyboard shortcuts & help**, explain the controls and the portal's answer/protection concepts. Click the question count for an overview, or **•••** for timing, question details, and early completion. Detail views opened from Practice tools include **Back** to return to that menu. Timing is collected quietly and stops when you leave practice or switch tabs. New sessions show their timer by default; each session remembers later visibility changes, and Settings controls the default for future sessions. The offline graphing calculator opens alongside the question with an expression list, graph, tables, parameter sliders, and linear/quadratic/cubic/exponential fitting. Its work is saved per session across questions, closing/reopening, and resuming; new sessions start clean. See [calculator usage and limits](docs/calculator.md). Notes are no longer part of the interface.
6. Results show correct, incorrect, and unanswered counts, with accuracy calculated only over submitted answers. Retry the entire session, its mistakes, or its unanswered questions as a new shuffled set. Original outcomes stay intact. **Review** begins with overall and domain-level performance across submitted attempts, including the answered denominator; unanswered work is excluded and repeated attempts count separately. It then provides latest-mistake and unanswered queues, contextual skills to revisit, and reusable history (Show older sessions reveals more). The unanswered queue contains questions assigned to a practice set that have never received a submitted answer, rather than the whole unseen bank. A later answer resolves a global unanswered item without rewriting older session results.
7. Navigation is ordered Practice, Review, Browse, Help, then the quieter **Settings icon**. Practice-test protection is a local preference; the Practice/Browse checkbox can override it for a selection. Active questions are hidden while protection is on; unknown metadata is included and remains explicit in question details. Opening an active question in Browse or starting any set containing active questions, including a historical retry, asks for confirmation. Global Review queues follow the Settings preference. Ordinary Help and Practice panels close when their backdrop is clicked; the calculator and destructive confirmations deliberately require their existing explicit controls. **Library & maintenance** is directly visible on Settings and contains corpus information, import history, backup/recovery tools, and a separate understated reset action. Direct question-file import controls have been removed; question preparation and normalization remain available administratively. Restore still validates and confirms before replacing data.
8. **Settings → Library & maintenance → Reset study progress** opens a simple confirmation with **Also clear bookmarks** unchecked. Confirming clears all attempts, sessions (completed and unfinished, including drafts and timing), and legacy notes. Bookmarks are retained unless explicitly selected for clearing. Questions, PDF images, import records, and interface preferences are preserved. Accuracy/mistake summaries return to empty because they are derived from those records. Cancel or Escape changes nothing. Every confirmed reset atomically saves the previous study state as **one** local recovery archive, replacing the previous archive. **Restore previous study state** appears only when a valid compatible archive exists and confirms before replacing current progress, including bookmarks. Recovered timers are paused. The archive includes all attempts, completed/unfinished sessions, drafts, timing, and annotations (including bookmarks and legacy notes); it excludes question content/assets, import receipts, and preferences. A later reset replaces it, even when current progress is empty. It is not a growing backup history.

Stage 4 applies a shared warm-paper / earthy-dark visual system to the existing flows. In **Settings → Appearance**, choose **Auto · follow system**, **Light**, or **Dark**. Auto follows live system changes; explicit choices persist locally. **Keep original PDF colors** preserves the source's white paper and exact figure colors instead of adapting it to the reading theme. Source files and stored image bytes are never changed. See [Stage 4 visual decisions and verification](docs/stage4.md), [Stage 3 decisions](docs/stage3.md), and [earlier milestone notes](docs/practice-redesign.md).

## Technology and storage

See [focused refinement decisions](docs/refinements.md) for the current Continue, bookmark/help, and reset recovery behavior. These supersede earlier single-session and direct-import UI descriptions in milestone notes.

- React 19, TypeScript, Vite; plain CSS and locally available system fonts. The lazy calculator uses locally bundled Math.js, KaTeX (with local fonts), and ml-matrix. No UI framework, CDN, authentication, analytics service, remote API, or hosted database.
- IndexedDB database **`sat-study-local`**, version 2, in the browser profile for `http://127.0.0.1:4317`. The `state` store retains the versioned question/progress snapshot under `current` and at most one versioned `sat-study-reset-v1` study-only archive under `reset-archive`; the `assets` store holds immutable PDF images as separate Blobs. Existing version-1 data migrates automatically.
- Questions, import provenance, every submitted attempt, bookmarks, session membership, optional session names/stars, drafts, elapsed time, and each session's timer visibility persist. Existing sessions without newer optional fields remain valid and use compatible defaults; no database migration is required. The legacy annotation `note` field remains dormant for compatibility with stored data and older backups; there is no note editing/display UI. Optional session calculator work is validated on backup recovery and included in the reset safety archive. Existing legacy notes remain in backups until progress is reset. Mutations are atomic IndexedDB transactions, and failed writes show an error.
- Browser data lives outside this repository and is not automatically synchronized or included in Git. Browser cleanup, profile deletion, or eviction can remove it. Full JSON backups include imported question content: keep them private.
- Use one study tab at a time. Transactions preserve concurrent changes, but live cross-tab UI synchronization is not implemented.
- Appearance and study preferences use localStorage (`sat-theme`, `sat-pdf-original`, `sat-timer-default`, `sat-show-correct-explanations`, and practice-test protection). They are separate from study data, survive progress resets, and need no network. There are no remote fonts; interface and reading type use local/system font stacks. Imported PDF typography remains part of its source image.
- Timers count foreground question time, can be paused, stop after submission, and checkpoint every five seconds and on navigation. A sudden process kill can lose up to roughly five seconds of timing; submitted answers and bookmarks are committed immediately. Timers do not count time while the app is closed. This is not a timed test simulator.

## Architecture

| Location                     | Responsibility                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `src/core/model.ts`          | Central question, attempt, annotation, session, and filter types               |
| `src/core/practice.ts`       | Pure scoring, filtering, session creation, and analytics                       |
| `src/core/commands.ts`       | Session lifecycle and validated, idempotent answer submissions                 |
| `src/core/taxonomy.ts`       | Scoped metadata identity and conservative label grouping                       |
| `src/core/review.ts`         | Session outcomes, review queues, and submitted-attempt performance summaries   |
| `src/importing/json.ts`      | Untrusted JSON validation and conservative duplicate handling                  |
| `src/importing/backup.ts`    | Full-state backup validation and download                                      |
| `src/storage/database.ts`    | IndexedDB connection and atomic read-modify-write operations                   |
| `src/ui/`                    | Screens, components, presentation state, and styles                            |
| `src/ui/useQuestionTimer.ts` | Foreground timing and persistence checkpoints, independent of layout           |
| `src/calculator/`            | Modular parser, numerics, regression, SVG graph, workspace and session adapter |
| `src/data/synthetic.json`    | Original examples for development and the empty-library fallback               |
| `scripts/serve.mjs`          | Dependency-free production server for built local assets                       |

Parsing, normalized data, persistence, and presentation are separate. The PDF preparation utility emits normalized JSON and local image assets; it never writes browser progress. See [PDF import instructions and classification](docs/pdf-import.md), [question format](docs/question-format.md), and [calculator investigation](docs/calculator.md). Durable product principles are in [AGENTS.md](AGENTS.md).

Question metadata and progress remain in a versioned snapshot. Large PDF image content is stored separately, so it is not rewritten when answers, bookmarks, or timers save. Full backups embed those images and can be large. For very long histories, separate question/attempt stores and indexes remain a possible future optimization. Multiple unfinished sessions are supported with a restrained Continue list and the existing Review history. Opening or starting one never auto-finishes another. Reset archiving uses the same atomic state transaction without a database/schema migration. Recovery validates references against the current corpus and refuses incompatible archives rather than silently dropping records. The automatic archive remains local to this browser and is not included in full backup files; use full backups for portability.

## Verification

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run test:e2e
```

Unit tests cover numeric equivalence, filtering, duplicate/import safety, backup validation, transaction concurrency, and rollback. Browser tests use installed Microsoft Edge, launch a temporary local production server, and exercise answering, explanations, filtering, bookmarks, keyboard behavior, reset options, reload persistence, backups, reset archive recovery/replacement, concurrent unfinished sessions, responsive overflow, and a workflow with all non-loopback requests blocked. For other machines, install Edge or change `channel` in `playwright.config.ts` to an available Playwright browser.

## Current limits and next steps

1. **Real exports:** The supplied PDF exports are prepared locally with metadata, source IDs, answer keys, and original-layout question/explanation images. The parser targets this specific export layout; arbitrary PDFs are not accepted directly by the browser. Search text is approximate and may omit math notation. Semantic math and full screen-reader transcription remain future work.
2. **Active comparison:** These exports were confirmed by the user to be separate active-only and inactive sets. The preparation utility also supports inclusive/exclusive comparisons with source IDs and flags inconsistent sets; uncertain matches remain unknown. New export modes must be stated explicitly.
3. **Calculator:** Offline graphing, arithmetic, tables and QR-based polynomial/log-linear exponential fits are available. This is an independent open-source-based implementation, not a licensed SAT/Desmos replica. Numerical graph searches are approximate; custom nonlinear regression and a structural math editor are deferred. See [calculator architecture and limitations](docs/calculator.md).
4. **Analytics:** Accuracy includes all attempts, not predicted SAT scores. Latest-answer status and ever-missed history are distinct. Timing is approximate, untimed practice only. Expand metrics only when the records support them.
5. **GUI:** Home, practice, and review now share semantic color/spacing/type tokens in `src/ui/tokens.css` and layout rules in `src/ui/styles.css`. Both themes are available; further visual changes should preserve tested study behavior. Source PDF images cannot be re-typeset or reflowed without a separate content-rendering project. The graphing calculator has a resizable side panel, an explicit expanded mode, and stacks below the question at widths up to 850 px.
6. **Packaging:** The local server must be running. There is no service worker, PWA installation, executable bundle, or cloud deployment. A desktop wrapper can reuse the same core and swap the persistence adapter later.

This project is not affiliated with or endorsed by College Board. SAT and Bluebook are their respective owners' marks.
