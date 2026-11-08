# Portal

A private, local-first study workspace for three standardized tests, built to be calm and question-centred. Everything runs in your own browser: no account, no analytics, no hosted database, and nothing you study is ever uploaded.

The portal serves three tests from one codebase. A switch in the header moves between them from any page, the last choice is remembered, and each has its own questions, progress, history and bookmarks. One of the three is in Spanish.

It ships with a small set of **original example questions** for each test (written for this portal), so there is something to study on the first visit. The real question banks are PDFs that you hold and add yourself.

## What you can do

- **Practice.** Pick a focus (section, domain, skill, difficulty, answer status, bookmarks), choose a session size and work one question at a time. Check an answer to see whether it was right, with the explanation. Sessions keep their order, position, drafts and timing, so you can leave and resume, and several can be open at once.
- **Review.** See accuracy by part, domain and skill, the mistakes you have not yet corrected, unanswered questions and bookmarks, and retry any of them as a new set. Percentages are plain percent-correct; the portal does not invent a score it cannot back up.
- **Browse.** Search the whole bank, read any question, and bookmark it without recording an answer.
- **Tests.** Where a test has a fixed or timed format, the portal can run it that way: modules, a timed run in the order of the real test, or fixed-composition practice tests, answered without feedback until the end. These open once you have added question PDFs of your own, because a test is built only from questions you brought.
- **Calculator.** A graphing calculator is bundled and works offline, and some tests also offer simple keypad calculators on the questions that allow one. None of them makes a network request.
- **Settings.** Light, dark or automatic appearance, a timer default, whether correct answers show their explanation, spoiler protection, and the switch for the example questions. You can also reset study progress (with one-step undo), remove your questions, or erase everything this site keeps on the device.

Keyboard control is built in (**Help** in the header lists the shortcuts), and the interface is designed to stay out of the way of the question.

## Bring your own questions

Choose **Add your question PDFs** (on the empty Home screen, or **Add PDFs** in Settings → Your questions) and drop your PDFs, or the folder that holds them, into the pop-up.

- **File names do not matter.** Each PDF is read once to see which test it holds questions for, and sorted for you. Anything that is not a question PDF is set aside.
- **Access code.** Each PDF carries an access code in small gray text at the bottom left of its pages. Finding it on any one page accepts the whole PDF; a PDF without a valid code is refused. The portal keeps only a one-way hash of each code, never the code.
- **Active and inactive questions.** Where a PDF marks questions as part of a live practice test, the portal reads that mark and hides those questions by default; the spoiler-protection controls appear only once you have added questions of your own.
- **Everything happens in your browser.** It reads the PDFs, cuts each question and explanation into an image, checks everything, and stores it locally. A large PDF can take ten minutes or more; keep the tab open. Questions it cannot read safely are left out with a reason in the report rather than guessed.
- **Updates.** When a new version of the portal has been downloaded, a pop-up asks you to update before carrying on. Updating re-checks your stored PDFs against the access codes that version accepts; questions from a PDF whose code is no longer accepted are removed, and your answers and bookmarks stay.
- **Examples.** Once a test has questions of your own, its example questions are hidden by default (one test keeps showing them by default), and **Settings → Study preferences → Include example questions** changes that. An imported question replaces an example with the same ID. Nothing is deleted either way.

Settings lists every PDF you added, with its question count, and can remove one. More detail: [the import notes](docs/pdf-import.md) and [the example questions](docs/examples.md).

## Privacy and offline

- Progress lives in your own browser's IndexedDB for the site's address. It is not synchronized between browsers, or between a local install and the hosted site. Clearing a browser's site data removes it.
- After the first visit a service worker keeps the whole app in the browser, so it opens and works with no network, and the page can be installed from the browser's menu. After the first copy, the question images live in the local database too.
- The calculator makes no external requests. Never commit an API key or any private data.
- Question material you import is data, not repository content: do not commit it, and do not publish a fork that includes it.

## Run on this laptop

Double-click the start file (the `.cmd` file in the project folder), or run:

```powershell
npm.cmd start
```

Open **http://127.0.0.1:4317** in your usual browser and keep the server terminal open. Use this exact address and the same browser profile each time; `localhost`, other ports and private windows have separate storage.

For a fresh checkout, install Node.js 22.12+ (Node 24 recommended), then:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd start
```

Installing dependencies needs the internet once; the built app and local server do not. The server uses Node's built-in HTTP server and binds only to `127.0.0.1`. Stop it with Ctrl+C. For front-end changes, stop the production server and run `npm.cmd run dev` at the same origin, and rebuild before using `npm start` again.

## Host it on GitHub Pages

`.github/workflows/deploy.yml` deploys the repository to GitHub Pages as a static copy of the app. The site contains only the app and the original example questions in `public/examples/`; the workflow fails the build if a prepared library, a PDF or an env file reaches it. The build uses relative URLs, so it runs at any subpath (set `VITE_BASE` to pin an absolute one). Progress on the hosted site is kept in each visitor's own browser.

## How it is built

React 19, TypeScript and Vite, with plain CSS and local system fonts. The calculator uses locally bundled DesQuill, Math.js, KaTeX and ml-matrix. Questions, progress, bookmarks and the question images are stored in IndexedDB, in atomic transactions, so a failed write shows an error instead of leaving data half-saved; preferences use localStorage.

| Location           | Responsibility                                                              |
| ------------------ | --------------------------------------------------------------------------- |
| `src/core/`        | Question and progress types, scoring, filtering, sessions, per-test rules   |
| `src/importing/`   | Untrusted-data validation, PDF reading, access check, example loading       |
| `src/storage/`     | IndexedDB connection, atomic updates, reset archive, local-data maintenance |
| `src/ui/`          | Screens, components, presentation state and styles                          |
| `src/calculator/`  | Parser, numerics, regression, graph, workspace and session adapter          |
| `public/examples/` | The bundled example questions and their images                              |
| `scripts/`         | Local server, service worker, example-question builder, developer tools     |
| `docs/`            | Design decisions and notes                                                  |

Parsing, normalized data, persistence and presentation are kept separate. Durable product principles are in [AGENTS.md](AGENTS.md); see also [question format](docs/question-format.md), [practice tests](docs/practice-tests.md) and [sessions](docs/sessions.md).

## Verify

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run test:e2e
```

Unit tests cover scoring, filtering, import safety, snapshot validation and transactions. Browser tests launch a temporary local production server (installed Microsoft Edge locally, Playwright's Chromium on CI) and exercise answering, filtering, bookmarks, keyboard control, resets and recovery, the update pop-up with a real service worker, responsive layouts, and a workflow with every non-loopback request blocked. On other machines, install Edge or change `channel` in `playwright.config.ts`.

## Limits

- The PDF reader targets one question-bank layout; other layouts are left out with a reason rather than guessed. The text kept for search can omit math notation, and the question image is the authoritative display.
- Timing is approximate and for untimed practice; time does not accumulate while the tab is hidden.
- Use one study tab at a time. Transactions preserve concurrent changes, but live cross-tab synchronization is not implemented.
- Locally the server must be running. There is no executable bundle; the hosted site can be installed as an app.

This project is not affiliated with or endorsed by any test publisher or testing organization.
