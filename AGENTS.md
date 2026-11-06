# Project principles

- Offline-first, private study on one laptop. Essential workflows must need no internet after installation.
- User-imported question material is data, never repository content. Commit only original synthetic examples. Never scrape or bypass College Board controls.
- Hide active practice-test questions by default. Unknown is explicit and is not a promise that a question is safe from spoilers.
- The question is central. Prefer study usefulness, calm typography, and accessible interaction over gamification or dashboards.
- Notes are intentionally absent from the product; retain the legacy note field only for stored-data/backup compatibility. Bookmarks remain useful, and progress reset preserves them unless the user explicitly chooses to clear them.
- Keep presentation highly iterable. Core question rules, import normalization, persistence, calculator providers, and analytics must remain separate from UI.
- The calculator is the locally bundled Offline engine and makes no external requests. Desmos was retired on 2026-11-03; the comparison scripts under `scripts/` use a Desmos key only on a developer's own machine, never in the app, the build or CI. Never commit an API key.
- The portal serves three tests, SAT, PAA and TSI, from one codebase. `assessment` is a first-class field on questions, attempts and sessions; stored data without it is SAT. Study screens get a view scoped to one test, progress and bookmarks never mix, and PAA and TSI internal IDs start with `paa-` and `tsi-` so they can never collide with an SAT ID or each other. Test differences live in `src/core/assessments.ts`, not in the UI. TSI items are labelled Official (College Board sample) or Original and the Official ones must stay easy to hide, remove or leave out of a build; the TSI has no clock and shows no score. See `docs/paa.md` and `docs/tsi.md`.
- Prefer maintainable, small solutions over enterprise complexity. Preserve progress and working behavior during redesigns.
- Validate imports as untrusted data. Do not execute imported HTML or fetch remote question assets.
- Run meaningful core and workflow tests before stable checkpoints. Never commit real exports, backups, or browser profiles.
