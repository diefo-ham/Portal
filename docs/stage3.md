# Stage 3 — Home and Results/Review

## Experience

Home is a compact practice composer: section, domain multi-selection, answer status, session length, and Start. Refine selection reveals skill multi-selection, difficulty, bookmarks, and a single protection checkbox. A saved session has a resume route with answered/remaining counts. A quiet review prompt resurfaces mistakes and unanswered assigned material without a dashboard. Browse still supports individual questions and searching. Settings retains its icon beside the other navigation items.

Both multi-selects open checkbox dropdowns with a compact selection count, Done/Clear actions, Escape dismissal, outside-click dismissal, and normal keyboard traversal. Larger option lists have local search. No library data or remote service is involved. Domains are ORed, skills are ORed, and the two groups are ANDed. Unselected groups mean any. Choosing another section clears both groups; changing domains prunes selected skills that do not belong to any remaining domain.

Answer status exposes All questions, Unanswered, Mistakes (latest answer incorrect), and Completed (any submitted answer). Granular historical statuses remain supported internally and in old backups. Protection is one checkbox, on by default according to Settings, with an intentional temporary override. The active/inactive/unknown metadata remains unchanged; unknown still passes protection because it is uncertain, not confirmed active. Settings and question details explain this. No additional technical status selector is exposed.

## Metadata investigation

The private PDF corpus has 29 section/domain-scoped skill labels. Its metadata uses consistent spellings in the prepared library. The synthetic dataset uses a few different capitalizations, notably Words in context / Words in Context, Central ideas and details / Central Ideas and Details, and Form, structure, and sense / Form, Structure, and Sense. The former dropdown used raw string uniqueness and displayed these variants separately.

`taxonomy.ts` groups only case and whitespace variants within the same section and domain. The most frequent source spelling supplies the display label. Matching labels in different contexts remain separate options with contextual labels. Similar but genuinely different labels, such as Probability versus Probability and conditional probability, remain distinct; the synthetic-only narrower classifications are not silently mapped to official skills. Original question metadata is never rewritten. Multi-select option IDs are JSON-encoded tuples containing the section and normalized domain/skill names.

## Results and historical practice

Results show three outcomes, a small outcome bar, and accuracy with the submitted-answer denominator made explicit. Incorrect and unanswered outcomes have direct retry actions when present. Entire-session replay is always available. Question details are collapsed by default and can be filtered by outcome. Unanswered previews do not reveal the answer/rationale.

Retries use the original question IDs and a copied original filter snapshot, create a new shuffled session, and preserve the old session. They do not re-filter the original membership using today's Home selections. If original membership includes active questions, the existing explicit confirmation still applies. Starting a retry follows the existing one-open-session rule. Resuming never shuffles or changes membership.

Global Review offers two routes: latest mistakes and previously assigned questions with no submitted answer anywhere. It follows the Settings protection preference and deduplicates IDs across sessions. An answered question disappears from the global unanswered queue, while its historical unanswered outcome stays intact. Current unfinished sets still have a resume route. Never-assigned bank questions are available through Home's Unanswered status without being treated as unfinished obligations.

Review shows recent sessions with all three counts and a route to their reusable results. Show older sessions reveals the remaining history. Skills to revisit and aggregate attempt accuracy are secondary disclosures. These serve retry decisions without restoring the previous statistics dashboard.

## Compatibility and architecture

- No IndexedDB upgrade or corpus migration. Existing answers, bookmarks, reset behavior, image assets, and imports are preserved.
- New optional `Filters.domains` / `Filters.skills` arrays retain scoped selections. Legacy `domain` / `skill` strings remain supported for existing records/backups. Saved filters copy selection arrays; restoring a backup validates them.
- Session scoring/outcomes, review queues, and metadata grouping live in core modules, independent of presentation. Home, Review, Results, and multi-select rendering are separate UI components.
- No theme system, new fonts, external assets, or online dependency. Stage 4 remains out of scope.

## Verification

- Production build and 17 core/storage tests.
- Twelve Edge workflow tests: multi-select intersection, snapshots and deterministic resuming; correct/incorrect/unanswered results; all three historical retry paths; global unresolved queues versus immutable historical outcomes; narrow layouts; keyboard and calculator behavior; active protection; reset bookmark options; reload/restart persistence; import/backup compatibility; offline practice.
- Private-library QA imports all 3,770 questions and 7,731 image assets in an isolated profile, checks domain/skill dropdown coverage against metadata, practices numeric and choice Math plus Reading & Writing, verifies explanations/reload persistence, and blocks non-loopback requests.
- Inspected rendered Home, Results, and Review screenshots. Source material and screenshots remain ignored private data.

For manual evaluation, try combining domains and skills, then changing domains to see incompatible skills drop away. Finish a set with mistakes and skipped questions, retry only its unanswered material, then return to the original results to see that those original outcomes remain unchanged. Check whether Home's resume/revisit cues and Review's history feel useful without becoming noisy.
