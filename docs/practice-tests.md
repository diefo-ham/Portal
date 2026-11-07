# Practice Test architecture

Practice Test extends `Session.practiceTest` (version 1). Ordinary sessions have no test metadata. The existing Practice component owns presentation, drafts, question navigation, bookmarks, rendering, shortcuts and calculator. In test mode, checking and correctness feedback are deferred until module completion. Navigation is scoped to the current module, while the stored session retains all included IDs for history and backups.

`core/practiceTest.ts` owns selection, module construction, clocks, progression, routing, exposure and scoring. `importing/practiceTestBackup.ts` validates saved test invariants. No external scoring services or proprietary tables are used.

## Locked until you import

The 120 bundled SAT examples have no active/inactive status and are never used to build a test. The Practice Tests screen opens only once the person has imported SAT questions of their own (`hasImportedQuestions`); until then it shows the locked screen with **Add your question PDFs**. See [examples.md](examples.md).

## Construction and exposure

Only imported `active` questions qualify. Ordinary Practice attempts do not consume test eligibility. Module counts are 27 R&W and 22 Math. Greedy deficit balancing targets Easy/Medium/Hard proportions of 30/40/30 (first), 50/35/15 (lower) and 15/35/50 (higher). It balances available domains equally and favors skill diversity. Missing difficulty counts as Medium; scarce domains/difficulties redistribute slots instead of inventing metadata. Module 2 is never exclusively Easy or Hard: insufficient variety blocks construction, and future full-test modules retain a small reserve of differing difficulty. Presentation order is shuffled with injectable randomness. These are approximate blueprints; metadata scarcity can prevent the intended mix.

At creation, two distinct uniform random question positions are designated simulated unscored. IDs are stored, never re-picked. All included IDs immediately enter `practiceTestUsedIds`; deletion/abandonment cannot restore eligibility. A Full Test requires capacity for two modules in each section before starting. New attempts also reserve enough capacity for future modules of unfinished Full Tests, so they cannot starve an existing attempt. Future module identities are chosen only when they begin, allowing the route to affect construction. Only included modules consume the exposure ledger.

## Timing and progression

The module clock uses persisted wall-clock start timestamps. Timed R&W modules last 32 minutes and Math 35 minutes; Untimed has no deadline. Both include time away from the page/browser, clearly disclosed in setup and exit help. The existing per-question timer separately records active question time. Timed elapsed is capped at the deadline. A late draft transaction is ignored after expiry. Completion grades saved valid drafts and leaves blank/invalid numeric drafts unanswered; it never synthesizes answers. Completion is idempotent, with stale UI transitions guarded by module index.

Full sequence: R&W first → routed R&W second → optional break → Math first → routed Math second → results. Completed modules cannot be edited or navigated back to. Resume after an expired module ends that module; the next starts when advanced. Break timing persists independently; reaching zero allows continuing and never starts Math without the student's action. Break duration is excluded from module results.

Live Practice tools offers Question overview, Question details, Cancel Practice
Test, and keyboard shortcuts/help. Finish through Question Overview's existing
Finish Module action and confirmation. Renaming is available from the Tests list
actions after exiting; there is no live rename or duplicate finish menu control.

## Routing and estimates

Routing excludes the two simulated unscored items. A correct answer earns difficulty weight 0.8/1/1.2 for Easy/Medium/Hard. Unanswered scored questions earn zero. Route metric = 70% weighted accuracy + 30% mean domain accuracy. Higher begins at metric >= 0.65, before rounding. The route is persisted as soon as the next module is constructed. This is deterministic and approximate, not official College Board routing.

Scored percentage uses correct / all scored questions, including unanswered. Results use long division with overlined repeating digits to retain exact percentages and also show the exact fraction. Incorrect, unanswered, domain, skill, section and module counts exclude simulated unscored items; detailed review retains every item's actual correctness and identifies its simulated scoring status.

Estimated section center = 200 + 600 × difficulty-weighted scored accuracy, +25 for higher route or −25 for lower route. Range is ±60 for two section modules, ±100 for a standalone module, rounded to tens and clamped to 200–800. A Full Test total sums section endpoints; a single section never fabricates a total. This heuristic is unvalidated and lacks IRT, item calibration, equating and actual pretest labels. Calibrate or replace routing/estimation in the isolated core functions.

## Persistence, reset and compatibility

IndexedDB stores test state with ordinary sessions, including drafts, calculator workspaces, routes, timing, break state and unscored IDs. Existing backups remain readable without test fields. New backups strictly validate test structure and restore start timestamps unchanged (ordinary timers retain paused-on-restore behavior). Overall reset archives and clears test exposure alongside answers and sessions, preserving bookmarks by default. Recovery restores exposure and original test clocks along with the rest of the study state. Resetting interface preferences or ordinary practice does not recycle test questions.

## Verification

- `npm test`: 130 passing unit tests across core, PDF, calculator, and Practice Test rules.
- `npx playwright test --workers=2 --retries=1`: 72 browser scenarios passed on the final build, without retries. Includes seven dedicated Practice Test scenarios and existing Practice, Browse, Review, PDF, reset, backup, keyboard, hosted-provider fixtures, Offline Calculator, geometry and responsive-layout regressions.
- `npm run build`: TypeScript and Vite production build passed. Vite retains the existing calculator chunk-size warning.
- Desktop setup and narrow-screen question/results screenshots were visually inspected.

An earlier three-worker run had one intermittent existing per-question timing snapshot assertion (250 ms difference between recorded attempt time and session elapsed time). The final two-worker run passed that assertion without a retry. Practice Test module clocks use separate persisted wall-clock timestamps and passed live deadline/stopwatch/resume tests.
