# Offline graphing calculator

> **Desmos was retired on 2026-11-03.** The portal now has one calculator, the bundled Offline engine. Parts of this note that describe a hosted Desmos mode are historical. See [Offline calculator vs Desmos](calculator-vs-desmos.md) for the comparison that led to this.

> Historical notes from the first calculator implementation. Current behavior,
> configuration, and limits are documented in [Calculator providers and input](calculator-providers.md).

Implemented 2026-10-26. This replaces the original two-number arithmetic panel.
It is an independent local calculator, with no Desmos code, assets, branding,
API key, assessment certification, or runtime service.

## Architecture and dependency decision

- **Math.js 15.2.0, Apache-2.0:** a number-only custom bundle with only `parseDependencies` supplies syntax trees,
  implicit numeric multiplication, precedence, and TeX conversion. Execution uses
  a small whitelisted real-number interpreter over these trees, rather than
  exposing Math.js's full expression evaluator. It rejects assignments inside
  scalar expressions, object/property access, strings, arrays, arbitrary calls,
  units, and recursive definitions. Ordinary operations call local JavaScript
  Math functions. Logarithm display is overridden to match base-10 `log` and
  natural `ln` semantics.
- **KaTeX 0.19.1, MIT:** locally bundled typesetting and fonts. Native editable
  text is paired with a mathematical preview and accessible MathML. TeX rendering
  is untrusted (`trust: false`) with expansion limits. No remote fonts or scripts.
- **ml-matrix 6.15.1, MIT:** QR least-squares solving. This supplies a tested
  numerical decomposition rather than inventing matrix factorization here.
- `@types/katex` is development-only. Versions are locked. Registry inspection
  checked licenses, release activity, and unpacked sizes before installation.
  The resulting lazy calculator code is about 150 KB gzip (about 515 KB minified),
  plus about 10 KB gzip CSS and local font assets. The entire font distribution
  occupies roughly 1.1 MB on disk; browsers load only the fonts in use. The study
  screens do not load the mathematical engine until Calculator is opened.

Primary references: [Math.js custom bundles](https://mathjs.org/docs/custom_bundling.html),
[parser security](https://mathjs.org/docs/expressions/security.html),
[KaTeX bundling](https://katex.org/docs/browser),
[ml-matrix QR](https://mljs.github.io/matrix/classes/QrDecomposition.html).
Production licenses/notices are included in `public/licenses/` and the build.
`npm run licenses` refreshes them; building also refreshes them automatically.

| Module                  | Responsibility                                                     |
| ----------------------- | ------------------------------------------------------------------ |
| `model.ts`              | Versioned workspace types, limits, validation, formatting          |
| `math.ts`               | Syntax normalization, AST validation, finite real evaluation, TeX  |
| `workspace.ts`          | Definitions/dependencies, expression classification, tables        |
| `numerics.ts`           | Bounded adaptive sampling, roots, points, implicit contours, fit   |
| `regression.ts`         | Centered/scaled QR fitting, predictions, residual statistics       |
| `Graph.tsx`             | SVG grid/curves, pan/zoom, coordinate inspection, window controls  |
| `TableEditor.tsx`       | Paired cells, pasted rows, keyboard editing                        |
| `Calculator.tsx`        | Expression workspace, typeset feedback, controls                   |
| `useCalculatorState.ts` | Session-scoped local persistence adapter                           |
| `layout.scss`            | Practice integration, loaded before the lazy engine to avoid jumps |
| `calculator.scss`        | Calculator controls and graph surfaces in both portal themes       |

## Expressions and graphs

Examples: `345*.17`, `1/2+1/3`, `2^12`, `sqrt(81)`, `log(100)`, `ln(e)`,
`y=2x+3`, `y=x^2-4`, `f(x)=x^2+1`, `f(3)`, `a=2`, `y=ax^2`,
`y=sqrt(x)`, `y=|x|`, `y=sin(x)`, `x=5`, `(2,3)`, `2x+3=11`,
`y<=2x+1`, `x>5`, and `x^2+y^2=25`.

Supported functions: sqrt, cbrt, abs, sin/cos/tan, asin/acos/atan, log (base 10,
optional second argument for another base), ln, exp, floor/ceil/round, min/max.
Constants: pi (or π), e, tau. Radians are the default; Degrees changes both
trigonometric input and inverse-trigonometric output. Powers use `^`; fractions
use `/`; parentheses make denominators/grouping explicit. Common `ax`/`bx`/`xy`
products are recognized; use `*` for other ambiguous adjacent letter products.
Nested absolute values should use `abs(...)`. Function definitions have one
argument, and independent scalar definitions can precede or follow their uses.

Every expression can be hidden or removed. Hidden definitions still define their
variables/functions; hiding affects drawing. Missing single-letter parameters
have contextual Add slider actions. A constant assignment such as `a=1` has a
slider; its literal text remains editable for precise values or larger ranges.

The graph supports colored simultaneous curves/data points, dragging, focused
wheel zoom, zoom buttons, keyboard pan, Reset view, and manual bounds. Labels
and curves remain readable in light, dark, and automatic themes. Normal graph
interaction preserves equal physical x/y unit lengths for the current panel
size; manual bounds expand one axis as needed to preserve that invariant.

Explicit functions use bounded adaptive sampling and separate paths at detected
holes, jumps, and asymptotes. Explicit inequalities shade above/below a curve or
left/right of a constant x boundary; strict boundaries are dashed. More general
implicit **equations** use a 100×80 approximate contour grid. Ambiguous saddle
cells and suspected pole crossings are omitted rather than guessed.

**Inspect points** reports numerical zeros, y-intercepts, local turning points,
function intersections, intersections with vertical equations, and data points
within the current window. Root candidates are bracketed/refined and checked
against the original function. A bounded local-minimum search also detects
non-sign-changing tangent roots. Clicking a curve reports evaluated coordinates;
clicking elsewhere explicitly labels an unsnapped cursor position. The point list
provides the same useful coordinates without requiring a mouse.

## Tables and regression

Add Table, enter paired x/y cells, or paste two tab/comma-separated columns.
An optional x/y or x₁/y₁ header is accepted. Enter or Up/Down moves in a column;
Enter/Down past the final row adds a row. Blank rows are ignored; partial or invalid
rows cause a clear message rather than silent data loss. Rows can be added/removed.
Pastes have at most 200 rows, exactly two columns, and no quoted-CSV interpretation.

The fit dropdown supports:

- Linear: y = mx + b.
- Quadratic: y = ax² + bx + c.
- Cubic: y = ax³ + bx² + cx + d.
- Exponential: y = a·bˣ, requiring positive y values.

Polynomial fits center/scale x, construct a Vandermonde design matrix, and solve
with QR. They do not use normal equations or visual approximation. Rank and
conditioning checks reject undetermined/unstable fits. Evaluation uses the scaled
polynomial to reduce cancellation; displayed coefficients are converted back to
ordinary x. Exponential fitting solves ln(y)=ln(a)+x ln(b) via the same QR path.
**It minimizes squared log residuals, unlike a nonlinear least-squares fit in y.**
The UI explicitly labels that distinction. It does not imply Desmos-equivalent
noisy exponential estimates.

The fitted curve, coefficients, observed-minus-predicted residuals, RMSE, and R²
are available. R²=1−SSE/SST and RMSE=sqrt(SSE/n), on the original y scale for every
model. R² is undefined for constant y, and exponential R² can be negative. At least
2/3/4 distinct x values are needed for linear/quadratic/cubic fits respectively.

## Practice and persistence

The normal panel stays beside the question on laptop widths over 850 px and
stacks below it on smaller windows. It can be resized with the pointer or expanded
with a labeled keyboard-accessible button. Expanded mode keeps Tab within the
labeled calculator dialog, makes the covered question controls inert, and provides
Reduce/Close/Escape. It is an intentional expanded workspace, not a new destination.
Native select controls retain Escape behavior. Reduced motion is respected.

All key events inside the calculator stay out of Practice's handlers: B cannot
bookmark, arrows cannot change questions, and Enter/Space cannot submit answers.
Expression Enter adds a row; graph arrows pan; table keys edit data. Closing restores
question focus. Normal unexpanded Tab can leave the calculator freely.

`Session.calculator?` stores a version-1 workspace: expressions/tables, visibility,
fits, angle mode, and viewport. Work is shared across nearby questions in that
session, including mixed-section transitions, and survives closing/reopening and
resuming. New/repracticed sessions begin clean. Stored work is retained in completed
session records, although this pass does not add a completed-workspace viewer.

Edits are immediate in memory, saved through the existing IndexedDB mutation layer
after 350 ms, and flushed on close, exit, finish, visibility changes, and unmount.
Abrupt process termination can lose the last fraction of a second of unsaved typing.
Saving failures use the existing error banner and retain a dirty snapshot for retry.
No separate localStorage database, global calculator history, or account is added.

The optional session field requires no IndexedDB version upgrade. Older saved
sessions/backups remain readable. Full backups validate and include calculator
work. Reset removes it with its sessions; the existing one-slot reset archive
captures/restores it automatically. Questions, assets, bookmarks/reset options,
and appearance preferences retain their existing behavior.

## Deliberate limitations

- This is not the licensed Desmos SAT assessment calculator or a feature-complete
  clone. No proprietary source, assets, branding, website, or API is included.
- No CAS/exact symbolic algebra, proof of all solutions, arbitrary precision,
  complex numbers, matrices, units, calculus commands, piecewise/domain-brace
  syntax, polar/parametric plots, lists of expressions, or animation system.
- No custom `y₁ ~ ...` regression language or nonlinear optimizer. Exponential
  fitting is explicitly log-linear. Those additions need separate correctness work.
- The editor is accessible text with live mathematical preview, not a structural
  fraction/keypad math editor. No software keypad is added for this laptop project.
- Numerical searches and fixed-budget sampling can miss closely spaced roots,
  very narrow features, extreme oscillations, tiny implicit components, or poles
  between samples. Implicit curves have no automatic intersection/extrema solver.
  These limitations are surfaced in calculator help/inspection, not hidden as
  claims of symbolic completeness.
- IEEE-754 double precision, roughly 15 significant digits internally; display is
  rounded to 10 significant digits. Known overflow, underflow, undefined operations,
  and unsafe syntax produce messages. Domain gaps are not joined deliberately.
- Bounds are limited to ±10¹⁰ with spans at least 10⁻⁷. A workspace has up to 24
  entries, 200 rows per table, 240 characters per expression/cell, and bounded AST
  complexity/definition depth. These prevent local hangs from pathological input.

## Verification and manual evaluation

`npm test` includes independent calculator tests for precedence, fractions, powers,
roots, logs, trig/angle modes, functions/definitions, invalid syntax, overflow,
discontinuities, tangent/sign-changing zeros, intersections, contours, tables,
known exact/noisy regressions, rank failures, and backup validation. Browser checks
exercise editing, plots, keyboard isolation, tables/paste, sliders, fit, pan/zoom,
close/reopen, multiple/resumed sessions, reset recovery, offline requests, themes,
expanded mode and laptop/mobile widths. Other study workflows remain regression
tested with isolated browser data.

Try these before expanding scope:

1. Plot y=x²−4 and y=2x+3, then Inspect points; click the coordinate list.
2. Plot y=1/(x−1), y=sqrt(x), and x²+y²=25. Confirm the circle remains circular while resizing.
3. Add x=[1,2,3], y=[4,7,10], fit Linear, and inspect m=3, b=1, R²=1.
4. Try Quadratic and Exponential with your own SAT data; compare the labeled
   log-space behavior if comparing noisy exponential fits with another calculator.
5. Define a=1 and y=ax², adjust the slider, close the calculator, move to another
   Math question, exit/resume the same session, then start a different session.
6. Evaluate the panel width, compact expression scroller, Expand/Reduce, and input
   feel on your actual school laptop in both themes.
