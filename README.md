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

Dependency installation requires internet once. The built app and local server do not. `npm start` uses Node's built-in HTTP server, binds only to `127.0.0.1`, and serves only `dist/`. It does not expose your repository or PDF files. Stop it with Ctrl+C. Port conflicts produce an error rather than silently changing your storage origin.

For frontend changes, stop the production server and run `npm.cmd run dev` at the same origin. Rebuild before using `npm start` again.

## First session

1. Click **Load synthetic sample** for 12 original examples. Two are marked active to demonstrate spoiler protection, and two have unknown status.
2. Choose section, domain, skill, difficulty, answer status, bookmark, and practice-test status filters. Active questions are hidden by default. Choose **Inactive only** if you also want to exclude uncertain questions.
3. Start a session (the first 5, 10, 20, or all matching questions, in library order), or open an individual question. A new session ends the previous one while retaining its submitted answers.
4. Submit an answer, read the explanation, bookmark, and take notes. Skip and return using the session map. Numeric questions accept equivalent decimal/fraction values.
5. Finish to review results. **Review & progress** shows recent sessions, latest mistakes, historical mistakes, accuracy, response time, and missed skills.
6. Export a full backup from **My data** periodically. Restore validates the backup and asks before replacing current data.

## Technology and storage

- React 19, TypeScript, Vite; plain CSS and locally available system fonts. No UI framework, CDN, authentication, analytics service, remote API, or hosted database.
- IndexedDB database **`sat-study-local`**, version 1, object store **`state`**, key **`current`** in the browser profile for `http://127.0.0.1:4317`.
- Questions, import provenance, every submitted attempt, notes, bookmarks, session membership, drafts, and elapsed time persist. Mutations are atomic IndexedDB transactions, and failed writes show an error.
- Browser data lives outside this repository and is not automatically synchronized or included in Git. Browser cleanup, profile deletion, or eviction can remove it. Full JSON backups include imported question content: keep them private.
- Use one study tab at a time. Transactions preserve concurrent changes, but live cross-tab UI synchronization is not implemented.
- Timers count foreground question time, can be paused, stop after submission, and checkpoint every five seconds and on navigation. A sudden process kill can lose up to roughly five seconds of timing; submitted answers and saved notes are committed immediately. Timers do not count time while the app is closed. This is not a timed test simulator.

## Architecture

| Location                     | Responsibility                                                       |
| ---------------------------- | -------------------------------------------------------------------- |
| `src/core/model.ts`          | Central question, attempt, annotation, session, and filter types     |
| `src/core/practice.ts`       | Pure scoring, filtering, session creation, and analytics             |
| `src/core/commands.ts`       | Session lifecycle and validated, idempotent answer submissions       |
| `src/importing/json.ts`      | Untrusted JSON validation and conservative duplicate handling        |
| `src/importing/backup.ts`    | Full-state backup validation and download                            |
| `src/storage/database.ts`    | IndexedDB connection and atomic read-modify-write operations         |
| `src/ui/`                    | Screens, components, presentation state, and styles                  |
| `src/ui/useQuestionTimer.ts` | Foreground timing and persistence checkpoints, independent of layout |
| `src/calculator/`            | Replaceable calculator panel; no storage or question-rule coupling   |
| `src/data/synthetic.json`    | Original examples, also downloadable inside the app                  |
| `scripts/serve.mjs`          | Dependency-free production server for built local assets             |

Parsing, normalized data, persistence, and presentation are separate. An eventual PDF parser should emit the documented JSON format for review before storage; it should not render question UI or write directly to IndexedDB. See [question format](docs/question-format.md) and [calculator investigation](docs/calculator.md). Durable product principles are in [AGENTS.md](AGENTS.md).

The database stores a versioned snapshot in one record for a simple personal-use MVP. Large libraries with many images or long histories may warrant separate question/attempt stores and indexes later. Preserve the storage interface and provide an explicit migration when doing so.

## Verification

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run test:e2e
```

Unit tests cover numeric equivalence, filtering, duplicate/import safety, backup validation, transaction concurrency, and rollback. Browser tests use installed Microsoft Edge, launch a temporary local production server, and exercise answering, explanations, filtering, bookmarks, notes, reload persistence, backups, malformed imports, responsive overflow, and a workflow with all non-loopback requests blocked. For other machines, install Edge or change `channel` in `playwright.config.ts` to an available Playwright browser.

## Current limits and next steps

1. **Real exports:** JSON import is implemented. The four supplied PDFs are not parsed or bundled. Add a dedicated parser with source IDs, manual preview, figure handling, and extraction-quality checks before importing real content. Plain text and embedded raster figures are supported; rich math typesetting, tables, and passage formatting need a future content model extension.
2. **Active comparison:** The tri-state field and filters are implemented. A paired-export comparison utility is not. Compare only equivalent export scopes; confidently matching `(source, sourceId)` in both exports means inactive, inclusive-only means active, and uncertain matches stay unknown. Never infer status from an unmatched PDF filename or fuzzy text alone.
3. **Calculator:** Offline arithmetic is available. Graphing needs a licensed offline Desmos integration or a separately assessed local graphing engine. No public Desmos website is embedded or copied.
4. **Analytics:** Accuracy includes all attempts, not predicted SAT scores. Latest-answer status and ever-missed history are distinct. Timing is approximate, untimed practice only. Expand metrics only when the records support them.
5. **GUI:** The current academic layout is a starting point. Iterate on `src/ui` and `src/calculator` while preserving tested import, scoring, and storage rules. Add a meaningful regression test when a behavioral edge case is fixed.
6. **Packaging:** The local server must be running. There is no service worker, PWA installation, executable bundle, or cloud deployment. A desktop wrapper can reuse the same core and swap the persistence adapter later.

This project is not affiliated with or endorsed by College Board. SAT and Bluebook are their respective owners' marks.
