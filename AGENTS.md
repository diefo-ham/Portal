# Project principles

- Offline-first, private study on one laptop. Essential workflows must need no internet after installation.
- User-imported question material is data, never repository content. Commit only original synthetic examples. Never scrape or bypass College Board controls.
- Hide active practice-test questions by default. Unknown is explicit and is not a promise that a question is safe from spoilers.
- The question is central. Prefer study usefulness, calm typography, and accessible interaction over gamification or dashboards.
- Notes are intentionally absent from the product; retain the legacy note field only for stored-data/backup compatibility. Bookmarks remain useful, and progress reset preserves them unless the user explicitly chooses to clear them.
- Keep presentation highly iterable. Core question rules, import normalization, persistence, calculator providers, and analytics must remain separate from UI.
- Prefer maintainable, small solutions over enterprise complexity. Preserve progress and working behavior during redesigns.
- Validate imports as untrusted data. Do not execute imported HTML or fetch remote question assets.
- Run meaningful core and workflow tests before stable checkpoints. Never commit real exports, backups, or browser profiles.
