# SAT affine inequalities and protection verification

## Affine inequalities

The custom Calculator accepts `<`, `<=`, `>` and `>=` with affine expressions
in `x` and `y` on either side: `4x+y<18`, `18>4x+y`, `2x-3y>=7`,
`x+y<=10`, `3y>2x-5` and `-2x+4y<=8`. Defined scalar coefficients, including
implicit products such as `a=4` followed by `ax+y<18`, use the existing
dependency resolver and update on edits. Coordinates never become fit parameters.

`calculator/affine.ts` extracts coefficients structurally after bounded definition
expansion. This avoids both guessing linearity from samples and subtractive loss
of small coefficients beside large constants. A single half-plane is clipped to
the current viewport rectangle. The fill and boundary are recomputed on pan,
zoom and resize. Strict boundaries are dashed; inclusive boundaries are solid.
Multiple expressions keep their existing independent colors and translucent
overlapping fills. A zero normal represents the full or empty plane without
inventing a boundary.

Boundaries retain function/vertical graph objects, so tracing, intercepts and
boundary intersections reuse existing graph interaction. Reported POIs belong
to boundaries only, even when the boundary itself is excluded by a strict
comparison. They are not feasible-region vertices or solutions of a system.
Nonlinear implicit inequalities such as `x^2+y^2<9` fail with an explicit affine
scope error. Existing explicit inequalities and restricted expressions continue
through their previous path. There is no system polygon engine or optimizer.

## Nonlinear fitting assessment

No nonlinear fitting extension was implemented. The concrete expression
`[a,a,c] ~ [230% of b,60% of c,p% of b]` creates residuals
`a-2.3b`, `a-0.6c`, `c-0.01pb`. All four names are unknown unless defined
elsewhere. The product `pb` is nonlinear in these unknowns. More fundamentally,
three equations cannot uniquely identify all four parameters here:

- For any nonzero `b=t`, exact solutions include `a=23t/10`, `c=23t/6`,
  `p=1150/3`.
- At `b=0`, `a=c=0` gives zero residual for every `p`.

Even the apparently determined ratio `p` requires excluding the zero branch.
Silently picking a scale or dividing by `b` would erase valid solutions. Near
`b=0`, the sensitivity of the residual to `p` vanishes, making numerical fitting
ill-conditioned. Constraints or prior scalar definitions can change which
parameters are identifiable; they cannot justify an arbitrary default tuple.
If a nonzero `b` is explicitly defined (for example `b=6`), the remaining
parameters enter linearly and the existing fitter already solves that variant:
`a=13.8`, `c=23`, `p=1150/3`. A focused compatibility test covers this, and
verifies that defining `b=0` still rejects the unidentifiable `p`. Choosing a
nonzero scale is a mathematical assumption, not an automatic rewrite of the
original problem.

The current architecture has two distinct tools:

- `regression.ts` requires parameters to enter affinely, builds a scaled design
  matrix, checks rank/conditioning, and uses QR least squares. Its small box-bound
  enumerator solves constrained affine fits. It also has dedicated table/list
  polynomial and log-space exponential models.
- `relations.ts` solves **one** free scalar using bounded rational-polynomial
  extraction/root isolation or bounded numerical roots. Candidates are verified
  against the original expression and parameter bounds. It is not a multivariate
  algebraic-system solver.

One could reuse QR, AST expansion, scalar isolation and residual checks for a
carefully restricted triangular system: eliminate an identifiable linear block,
reduce to one free scalar, enumerate roots, and verify every candidate. To cover
this example faithfully it must also represent free-parameter families, branch
conditions, zero pivots and partially identifiable parameters. Those result types
and elimination rules are absent. Adding a special division-by-`b` shortcut is
not a safe small extension to a fitter that promises identifiable parameters.

General noisy nonlinear list fitting would instead require a numerical
least-squares subsystem: initial guesses/multiple starts, Jacobians, scaling,
rank and identifiability diagnostics, bounds, damping/trust regions, convergence
criteria and residual reporting. It introduces local minima, multiple roots,
flat directions, singular branches, domain failures and overflow. An optimizer
would still not cure this example's non-uniqueness. Finite exact algebraic systems
could be handled without optimization, but require a separate, substantial
elimination/solution-family design rather than a regression patch.

For this pass, SAT utility does not justify that complexity. The existing clear
unsupported-result message remains tested; **Use Desmos** remains the intended
secondary escape hatch when available. A hosted fitter's output must still be
interpreted in light of underdetermination. No proprietary bundle is cached,
no new dependencies are introduced, and ordinary linear/table/list fitting,
scalar solving, constraints, named functions and domains retain their existing
compatibility tests.

## Protection semantics

Active-question protection and Test exposure remain separate:

- Default ordinary Practice and Browse filters exclude `active`; `inactive` and
  explicit `unknown` questions remain eligible. Unknown is not a safety promise.
- Global Review mistakes, unanswered, domain practice and bookmark queues apply
  protection. Bookmarking does not override it.
- Advanced filters can intentionally include/show only active questions. Browse
  asks before opening an active question. Any new ordinary session containing
  active IDs requires the portal's warning and **Begin anyway**, including
  Practice Again and per-session/Test-result retry actions. Cancel creates no set.
- Reopening a previously saved session or its results preserves its exact IDs,
  order and progress, including active questions; protection does not rewrite
  historical assignments. This is an intentional exception, not fresh sampling.
- Practice Tests intentionally select active questions. `practiceTestUsedIds`
  prevents their reuse in later Tests until reset. That ledger does not filter
  ordinary Practice or Browse, and ordinary Practice does not consume it.
- Progress reset keeps question statuses and protection preferences, preserves
  bookmarks by default, and separately clears the exposure ledger. Recovery
  restores study records/ledger without changing preferences. Portable backups
  restore an explicitly saved protection setting; legacy backups without that
  preference retain the current setting. An explicit backed-up `false` is an
  intentional preference restoration, not an inferred weakening.

## Automated coverage

`tests/affine.test.ts` covers coefficients, comparator reversal, all four
comparators, scalar dependencies, vertical/degenerate cases, pan/zoom clipping,
large offsets, boundary-only POIs, simultaneous boundaries, circular/undefined
definitions, nonlinear rejection and the deliberate unsupported SAT list fit.
`tests/browser/calculator-affine.spec.ts` checks actual SVG fill containment,
boundary coordinates, dash styles, coexistence, inspection, pan/zoom, coefficient
edits and persisted reloads.

`tests/protection.test.ts` constructs 1,080 original synthetic questions with all
three statuses, checks protected candidates across sizes/seeds/sections/statuses,
bookmarks and review, and separates Test exposure from Practice eligibility.
`tests/browser/protection.spec.ts` exercises the actual UI selection and warning
paths, saved sessions and results, bookmarks/review, Tests, reset/recovery, and
new/legacy backup restoration. Existing suites retain scoring, routing, ledger,
calculator/provider and backup coverage.

Verification on this pass:

- `npm test`: **184/184 passed** (six files).
- `npx playwright test --workers=2`: **87/91 passed** initially. Four failures
  were stale assertions: requiring rectangular SVG shading, expecting automatic
  calculator reopening after timer pause, native rather than portal active-question
  confirmation, and old navigation/Help text. After aligning those tests with
  current behavior, the affected calculator/focused-Practice scenarios passed;
  the final Help/overlay file rerun passed **3/3**. All **91 distinct scenarios**
  are verified across the full run and targeted reruns, including all seven new
  affine/protection scenarios. No product behavior was changed to satisfy these
  legacy assertions.
- `npm run build`: TypeScript and Vite production build passed. The existing
  calculator chunk-size warning remains.
- Inspected the browser screenshot of simultaneous `ax+y<18` and `y>14`,
  including dashed boundaries, overlapping fills and boundary inspection points.
