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

The local server must run during study. No PWA/service-worker caching claim is made. No test-publisher content is used as tracked repository fixtures. A licensed offline graphing integration remains future work.

## PDF import verification

The next implementation imported all 3,770 unique source question IDs: 1,748 inactive and 2,022 active, with zero unknown or quarantined items. Classification uses source metadata and the user's confirmation that the active files contain active-only questions. Private source hashes, page provenance, and coverage are retained in `private-data/library/import-report.json`.

The full corpus was imported into an isolated browser context with all non-loopback requests blocked. Every manifest asset was stored locally; representative numeric Math, multiple-choice Math, and Reading & Writing questions displayed, accepted answers, showed explanations only after submission, and retained progress after reload. Private screenshots were visually inspected; a tight math crop found during that review was corrected, and blank page margins were trimmed. Real question screenshots remain excluded from Git.

Regression coverage now additionally includes PDF panel/schema validation, separate image storage, portable image backups and restoration, annotation suppression, rationale-derived explicit keys, accepted numeric rounding variants, and migration of existing version-one study data. Tests use synthetic content. Test output and temporary browser profiles now live outside OneDrive.

Final checks: production build passed; 12 TypeScript/core tests, five browser tests, and three synthetic PDF tests passed. The separate complete-corpus browser check also passed with all external requests blocked.
