# MVP verification

Verified on 2026-10-25 using Node 24.22.1 and Microsoft Edge on Windows.

- Production TypeScript/Vite build passed. All JS, CSS, example data, and fonts are local; the production server needs only Node and `dist/`.
- Eight core tests passed: import validation, active/unknown filters, fraction/decimal scoring, latest versus historical mistakes, source-aware deduplication, backup validation, session submission guards, and concurrent IndexedDB writes with rollback.
- Three browser tests passed: the principal study workflow with non-local requests blocked; browser-process close/reopen with saved progress intact; invalid import handling and narrow-screen overflow checks.
- Workflow coverage: sample import; active-only and default filter results; wrong and correct submissions; rationales; bookmark and note persistence after reload; navigation; session results; mistakes; basic analytics; backup download and confirmed restore; duplicate import skipping.
- Browser restart coverage used a temporary persistent Edge profile. A submitted answer and selected option survived closing the entire browser context, relaunching the browser, and resuming the session.
- The no-network workflow aborted every request outside `http://127.0.0.1:4317`; no external application requests were observed. This checks the app's runtime dependencies, not the browser's unrelated background networking. The laptop's physical network adapter was not disabled.
- Visual inspection in the in-app browser confirmed the library and practice layouts. Timing resumed from saved data and the pause control worked. A screenshot is in `screenshots/practice.png`.
- Dependency installation audit reported zero known vulnerabilities after updating Vitest to a patched version.

The local server must run during study. No PWA/service-worker caching claim is made. The supplied College Board PDFs were not imported or used as repository fixtures. PDF extraction quality and a licensed offline graphing integration remain future work.
