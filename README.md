# SAT Study

A private, local-first SAT practice workspace. The application bundles **only original synthetic questions**. It does not scrape College Board, redistribute its question bank, or send study data anywhere.

## Use on GitHub Pages

The repository deploys to GitHub Pages with `.github/workflows/deploy.yml`. The hosted site is a static copy of the app. It contains **only the 12 original synthetic questions** and the import features. It never includes a prepared PDF library: `private-data/` is git-ignored, and the workflow fails if a library, PDF, or env file reaches the build.

- Progress lives in your own browser's IndexedDB for the site's address (`https://<user>.github.io/<repo>/`). It is separate from any `http://127.0.0.1:4317` data and is not uploaded anywhere.
- To move progress between a local install and the hosted site, use **My data → Export full backup** and **Restore a backup**. Backups can include imported question content, so keep them private.
- Question material you import yourself stays in your browser. Do not commit it, and do not publish a fork that includes it.
- The hosted calculator is the bundled Offline calculator. The committed `public/calculator-config.json` holds an empty Desmos key, and the workflow fails if that changes, so the official Desmos mode stays unconfigured there. Never commit an API key; local keys belong in `.env.local`.
- The build uses relative URLs, so it runs at any subpath. To pin an absolute base, set `VITE_BASE` (for example `VITE_BASE=/sat-portal/ npm run build`).
- **Offline:** after the first visit a service worker keeps the whole app, including the calculator, in the browser, so it opens and works with no network. A new version takes over after every tab of the site is closed, so a session never mixes versions. The page can also be installed from the browser's menu.

### Bring your own questions

The hosted site never supplies third-party question banks. You bring material you already hold, in one of two ways:

**From the PDF exports directly.** Open **Settings → Library & maintenance → Prepare from your PDF exports**, choose the four exports (`read_write_inactive.pdf`, `read_write_active.pdf`, `math_inactive.pdf`, `math_active.pdf`), say whether the active files contain only active questions, and start. The browser reads the PDFs, cuts each question and explanation into an image, checks everything, and stores it locally. Nothing is uploaded, and it works offline once the PDF reader has been used once. It takes about 5 to 10 minutes for the full exports; keep the tab open. The result matches the Python tool described below (see [the scope and parity notes](docs/in-browser-pdf-import-scope.md)). It needs a browser that can save WebP images (current Chrome, Edge, or Firefox).

**From a prepared folder.**

1. Prepare a library folder on your own computer from your PDF exports with the preparation tool: see [PDF import instructions](docs/pdf-import.md). It writes `manifest.json`, `questions.json`, and an `assets` folder of original-layout images.
2. On the site, open **Settings → Library & maintenance → Choose library folder** and select that folder.
3. The browser checks the manifest, the question file's checksum, and every image's checksum, then stores everything locally. Nothing is uploaded, and it works offline afterwards. Active questions stay hidden by default.

Importing the full 3,770-question library took about 10 seconds in testing. Each person imports their own copy, and a backup (**Export full backup**) moves it between browsers.

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
2. On **Practice**, use the compact **All / Reading & Writing / Math** section control, then choose any combination of domains and answer statuses. **Refine selection** reveals skill and difficulty multi-selects, bookmarks, and one practice-test protection checkbox. Selections within Domain, Skill, Answer Status, and Difficulty are combined with OR; the filter groups combine with AND. An empty selection means any. Section limits the available domains; choosing domains under All narrows the scope without requiring a redundant Section choice. Higher-level changes retain still-valid lower selections and remove only incompatible domains or skills.
3. Enter any whole-number session size from 1 through the displayed maximum. If filters reduce the available pool below the entered number, the new maximum appears and Start stays unavailable until the number is valid. The whole filtered pool is shuffled before selecting the requested size; answer-choice order is unchanged. An immediate identical order is avoided when the set contains multiple questions. The selected order is saved once and stays fixed when resuming. **Browse** is a separate searchable question reader: it opens individual questions, supports bookmarking and previous/next movement through the current matches, and never creates or resumes sessions. Starting a new set from Practice leaves other unfinished sessions available in the **Continue** area, with a derived section/focus/count label, answered/remaining counts, and start time. A session can be renamed (80 Unicode characters, trimmed) or quietly starred from its contextual controls. Completed starred and recent sessions remain in Practice, with a searchable **View all sessions** disclosure. Each session retains its own order, position, drafts, timing, name, and star state.
4. Choose an answer and **Check answer**, then continue. 1–4 and A–D select their matching choices while reading. While reading the question, Enter or Space performs the primary action: check the answer, advance after feedback, or review the last question. Left/Right move to the previous/next question without submitting; Right on the final question does nothing. Focused controls retain normal Space/arrow behavior (radio choices, text carets, calculator inputs, and checkboxes). Focused buttons retain their normal Enter/Space action. Numeric entries also support Enter to submit. Numeric questions accept equivalent decimal/fraction values. Correct answers show concise confirmation by default with an optional **View explanation** disclosure; Settings can restore automatic explanations. Incorrect answers always show their explanation.
5. The star or **E** bookmarks a question; B remains available for answer choice B. A mouse click on the Practice star returns focus to the reading surface; keyboard activation retains button focus. Browse also allows bookmarking without recording an answer or creating a session. **Review → Bookmarks → Practice bookmarks** starts a shuffled set of saved questions while respecting practice-test protection. The bookmarked-only filter remains in Browse and Refine selection. **Help** in the main navigation, and **Practice tools → Keyboard shortcuts & help**, explain the controls and the portal's answer/protection concepts. Click the question count for an overview, or **•••** for timing, question details, and early completion. Detail views opened from Practice tools include **Back** to return to that menu. Timing is collected quietly and stops when you leave practice or switch tabs. New sessions show their timer by default; each session remembers later visibility changes, and Settings controls the default for future sessions. Calculator floats above the unchanged question and opens the integrated Calculator by default. **Use Desmos** opens the optional official hosted tool when configured; **Back to Calculator** returns to the integrated workspace. Their state remains separate and saves per session. Drag the window title and resize its edges/corner; Reset window restores useful geometry. New sessions start clean; completed Math results can reopen their saved calculator. See [current setup, stabilization and live Desmos checks](docs/calculator-stabilization.md) and [earlier comparison notes](docs/calculator-parity.md). Notes are no longer part of the interface.
6. Results show correct, incorrect, and unanswered counts, with accuracy calculated only over submitted attempts. Retry the entire session, its mistakes, or its unanswered questions as a new shuffled set. Original outcomes stay intact. **Review** uses one semicircular gauge for All, Math, Reading & Writing, or the one currently expanded domain. Correct and incorrect arcs divide all submitted attempts; zero-data scopes use a neutral **No attempts yet** state. All eight SAT domains remain visible, and only one opens at a time. Compact attempt marks show individual outcomes up to twelve attempts and grouped evidence beyond that, while domain drilldown reveals real imported skills and contextual practice actions. Every percentage is correct submitted attempts divided by all submitted attempts in that scope; unanswered work is excluded and repeated attempts count separately. Latest-mistake, assigned-unanswered, and bookmark queues share one return-to-study group. Completed session rows show active study time when recorded; detailed results show the session total, average time per submitted answer, and recorded question time. A later correct answer removes a question from the current Mistakes queue without erasing its earlier incorrect attempt from historical performance.
7. Navigation is ordered Practice, Review, Browse, Help, then the quieter **Settings icon**. Practice-test protection is a local preference; the Practice/Browse checkbox can override it for a selection. Active questions are hidden while protection is on; unknown metadata is included and remains explicit in question details. Opening an active question in Browse or starting any set containing active questions, including a historical retry, asks for confirmation. Global Review queues follow the Settings preference. Ordinary Help and Practice panels close when their backdrop is clicked; the calculator and destructive confirmations deliberately require their existing explicit controls. **Library & maintenance** is directly visible on Settings and contains corpus information, backup/recovery tools, and a separate understated reset action. Direct question-file import controls have been removed; question preparation and normalization remain available administratively. Restore still validates and confirms before replacing data.
8. **Settings → Library & maintenance → Reset study progress** opens a simple confirmation with **Also clear bookmarks** unchecked. Confirming clears all attempts, sessions (completed and unfinished, including drafts and timing), and legacy notes. Bookmarks are retained unless explicitly selected for clearing. Questions, PDF images, import records, and interface preferences are preserved. Accuracy/mistake summaries return to empty because they are derived from those records. Cancel or Escape changes nothing. Every confirmed reset atomically saves the previous study state as **one** local recovery archive, replacing the previous archive. **Restore previous study state** appears only when a valid compatible archive exists and confirms before replacing current progress, including bookmarks. Recovered timers are paused. The archive includes all attempts, completed/unfinished sessions, drafts, timing, and annotations (including bookmarks and legacy notes); it excludes question content/assets, import receipts, and preferences. A later reset replaces it, even when current progress is empty. It is not a growing backup history.

Stage 4 applies a shared warm-paper / earthy-dark visual system to the existing flows. In **Settings → Appearance**, choose **Auto · follow system**, **Light**, or **Dark**. Auto follows live system changes; explicit choices persist locally. **Keep original PDF colors** preserves the source's white paper and exact figure colors instead of adapting it to the reading theme. Source files and stored image bytes are never changed. See [Stage 4 visual decisions and verification](docs/stage4.md), [Stage 3 decisions](docs/stage3.md), and [earlier milestone notes](docs/practice-redesign.md).

## Technology and storage

See [focused refinement decisions](docs/refinements.md) for the current Continue, bookmark/help, and reset recovery behavior. These supersede earlier single-session and direct-import UI descriptions in milestone notes.

- React 19, TypeScript, Vite; plain CSS and locally available system fonts. The integrated Calculator uses locally bundled DesQuill, Math.js, KaTeX (with local fonts), and ml-matrix, so it needs no external requests. Optional Desmos access loads only the official hosted API in a separate frame; no question content is passed to it. No authentication, analytics service, or hosted database is required.
- IndexedDB database **`sat-study-local`**, version 2, in the browser profile for `http://127.0.0.1:4317`. The `state` store retains the versioned question/progress snapshot under `current` and at most one versioned `sat-study-reset-v1` study-only archive under `reset-archive`; the `assets` store holds immutable PDF images as separate Blobs. Existing version-1 data migrates automatically.
- Questions, import provenance, every submitted attempt, bookmarks, session membership, optional session names/stars, drafts, per-question elapsed time, and each session's timer visibility persist. Session active time is derived by summing those saved question values; submitted attempts snapshot their question time. Existing sessions without recorded milliseconds remain valid and simply omit timing summaries, so no data migration is required. The legacy annotation `note` field remains dormant for compatibility with stored data and older backups; there is no note editing/display UI. Optional session calculator work, including separate opaque Desmos state and legacy-compatible Calculator entries, is validated on backup recovery and included in the reset safety archive. Existing legacy notes remain in backups until progress is reset. Mutations are atomic IndexedDB transactions, and failed writes show an error.
- Browser data lives outside this repository and is not automatically synchronized or included in Git. Browser cleanup, profile deletion, or eviction can remove it. Full JSON backups include imported question content: keep them private.
- Use one study tab at a time. Transactions preserve concurrent changes, but live cross-tab UI synchronization is not implemented.
- Appearance and study preferences use localStorage (`sat-theme`, `sat-pdf-original`, `sat-timer-default`, `sat-show-correct-explanations`, and practice-test protection). They are separate from study data, survive progress resets, and need no network. There are no remote fonts; interface and reading type use local/system font stacks. Imported PDF typography remains part of its source image.
- Timers count foreground question time, can be paused, stop after submission, and checkpoint every five seconds and on navigation. Hiding the visible timer does not pause measurement. Time does not accumulate while the tab is hidden, Practice is closed, or a session is merely waiting to be resumed. A sudden process kill can lose up to roughly five seconds of timing; submitted answers and bookmarks are committed immediately. This is not a timed test simulator.

## Architecture

| Location                     | Responsibility                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `src/core/model.ts`          | Central question, attempt, annotation, session, and filter types               |
| `src/core/practice.ts`       | Pure scoring, filtering, session creation, and analytics                       |
| `src/core/commands.ts`       | Session lifecycle and validated, idempotent answer submissions                 |
| `src/core/taxonomy.ts`       | Scoped metadata identity and conservative label grouping                       |
| `src/core/review.ts`         | Session outcomes, current-status queues, and historical attempt analytics      |
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

1. **Real exports:** The supplied PDF exports are prepared locally with metadata, source IDs, answer keys, and original-layout question/explanation images. The parser targets this specific export layout. The Settings page prepares those four exports directly in the browser; other PDF layouts are not supported and are left out with a reason rather than guessed. Search text is approximate and may omit math notation. Semantic math and full screen-reader transcription remain future work.
2. **Active comparison:** These exports were confirmed by the user to be separate active-only and inactive sets. The preparation utility also supports inclusive/exclusive comparisons with source IDs and flags inconsistent sets; uncertain matches remain unknown. New export modes must be stated explicitly.
3. **Calculator:** The integrated Calculator uses bundled structural input, graphs, tables/lists, QR polynomial fits (including sparse models through degree three), and original-y exponential fitting. Custom bases linear in their fitted parameters are also supported, and numerical graph searches are approximate. Official Desmos remains available for advanced cases when configured and selected. See [current calculator behavior and limits](docs/calculator-floating.md).
4. **Analytics:** Accuracy includes all attempts, not predicted SAT scores. Latest-answer status and ever-missed history are distinct. Timing is approximate, untimed practice only. Expand metrics only when the records support them.
5. **GUI:** Home, practice, and review now share semantic color/spacing/type tokens in `src/ui/tokens.css` and layout rules in `src/ui/styles.css`. Both themes are available; further visual changes should preserve tested study behavior. Source PDF images cannot be re-typeset or reflowed without a separate content-rendering project. The calculator is a nonmodal, freely draggable/resizable floating window that never changes Practice width. At widths below 620 px it uses a viewport-constrained overlay.
6. **Packaging:** Locally the server must be running. The hosted site works offline through its service worker and can be installed as an app. There is no executable bundle. A desktop wrapper can reuse the same core and swap the persistence adapter later.

This project is not affiliated with or endorsed by College Board. SAT and Bluebook are their respective owners' marks.
