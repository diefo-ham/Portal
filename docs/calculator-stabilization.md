# Calculator stabilization — 2026-10-27

## Official Desmos and local key

The supplied personal-project key is stored only in ignored `.env.local` as
`DESMOS_API_KEY`. The committed `.env.example` contains empty placeholders.
Both the production server and Vite read this file through a local, no-store
`/calculator-config.json` response. The key is not embedded in build output.
Close/reopen Calculator to reread a changed key; no rebuild is necessary.
Existing `VITE_DESMOS_API_KEY` build-time configuration remains compatible.
Automated test servers use `--no-local-config` and mock this boundary.

The browser-side API key is naturally visible to the browser and to Desmos;
this is the supported API model, not a new authentication/backend system.
The environment file itself is never served. No real key appears in these docs.

Official v1.12.0 successfully initialized with the supplied key in installed Edge.
The [official changelog](https://www.desmos.com/api/changelog) identifies v1.12 as
the current stable API; v1.13 is experimental until spring 2027. Desmos displays
its own **Trial Key** notice for this key. The notice was not hidden or bypassed.

Expression controls, Add Item, table input, custom `~`, regression templates,
sliders, graph settings, POIs, tracing and fraction conversion remain native.
`customRegressions`, `regressionTemplates`, `trace`, `pointsOfInterest` and
`decimalToFraction` are enabled through documented options. No Offline parser
intercepts Desmos expressions. Question content never enters the iframe.

Desmos stays the configured default for fresh workspaces. An explicit saved
Offline choice is honored. Only selecting Desmos mounts its hosted frame/API;
Offline makes no Desmos requests. Failures remain retryable in that tab with a
6.5-second deadline, no polling or automatic retries. Reconnection does not
interrupt Offline; a loaded Desmos instance survives the browser's offline event.

## Offline regressions

- `~` is classified as a relation rather than requiring table-column syntax.
  Scalar relations such as `8c ~ 3` fit undefined symbols (`c = 0.375`) by
  minimizing the left-minus-right residual. The same scaled QR path supports
  scalar or list residuals and rejects underdetermined, ill-conditioned, or
  nonlinear-in-parameter relations. Already-defined variables remain fixed.
- Enter `y_1 ~ m x_1 + b` directly after populating a table or defining lists.
  Full and sparse polynomial terms through degree 3 remain supported.
- Exponential forms include `a b^x_1`, `a exp(b x_1)` and `a e^(b x_1)`.
  They use the same bounded, original-y least-squares variable-projection solver;
  the rate parameter is converted appropriately for exp/e notation. Positive y
  remains required. This is not Desmos's proprietary general nonlinear optimizer.
- New custom models may be nonlinear in x but must be **linear in their fitted
  parameters**, e.g. `a sin(x_1) + b` or `a/x_1 + b`. A bounded safe AST checks
  linearity structurally. Scaled QR solves up to five single-letter parameters,
  with rank/conditioning/domain checks. Parameters inside functions, multiplied
  together, or in variable powers/denominators are rejected explicitly.
- Original-y residuals, RMSE and R² remain available. Constant-y R² is undefined;
  unrecorded data is not fabricated. No new statistics package was added.
- Table Fit templates coexist with expression-list fits. Both expose **Export to
  expression list**, which adds independent editable `y=...` math and preserves
  the source regression/table. Very long exports are rejected before saving.

### Numerical presentation

QR-based polynomial coefficient display tolerances use data magnitude, scaled
design conditioning and the transformation back into x coordinates. Only values
within estimated numerical resolution become displayed zero/integer values.
Zero terms and unit coefficients are omitted from the displayed equation.
For exact square data, the display is `y ≈ x²`, not machine-epsilon terms.
Tiny meaningful coefficients remain visible when meaningful at the data scale.

Raw fitted coefficients, predictions and residuals retain their full values.
Displayed equations use ten significant digits for remaining nonzero values.
Export uses the cleaned coefficients at full remaining precision; it is an
ordinary editable approximation. The original fitted model is unchanged.

## Graph rendering and inspection

The old sampler could spend its entire budget subdividing offscreen values.
Sampling now prunes such intervals only after checking an estimated off-center
turning point. Visible regions get pixel-aware subdivision down to a bounded
subpixel scale. Steep straight lines are not mistaken for discontinuities solely
because their vertical change is large. Unresolved curvature/domain holes remain
gaps. Work stays bounded; arbitrary subpixel spikes are not guaranteed detectable.

Major grid steps retain their scale; five quieter subdivisions adapt with them.
The axes remain distinct in both themes.

Trace points remain one temporary cursor and never add expressions. Meaningful
POIs/data points can now be selected independently: click to keep a label, click
again to remove it. Hover/focus reveals transient labels. Deselect suppresses the
pointer-capture re-entry hover until the pointer leaves, so removal is visible.
Labels stay graph-local, with restrained collision offsets and connecting lines.
Escape on the graph clears inspection labels before closing Calculator.

Coordinate labels recognize bounded rationals and small rational multiples of π
under tight numerical tolerances. Otherwise they show decimals. Labels retain
`≈`: recognition is not a symbolic proof. Zero is not substituted for arbitrary
tiny nonzero coordinates. Explicit scalar-parameter points remain draggable.

Point selection uses pixel-space distance rather than mathematical-coordinate
distance: visible markers remain small, while mouse/trackpad clicks receive a
22-pixel target and touch receives 30 pixels. Draggable points take precedence,
then the nearest POI/data point, then curve tracing, so a nearby trace does not
steal an intended POI click.

Equal physical x/y unit scale is now the default and is persisted as a graph
viewport mode. Initial/Reset view, ordinary pan/zoom and calculator resizing
preserve it by adapting the y range to the rendered aspect ratio; a rectangular
graph therefore shows more of one axis without stretching circles. Fit and
manual graph-window bounds may intentionally turn equal scaling off. Square axes
restores it explicitly.

## Compact input and tables

- One **+** Add control offers Expression/Table and dismisses outside or with
  Escape. Typing `table` still creates a table.
- Scalar rows have no irrelevant visibility dot. `a=2` has its compact slider;
  dependent `b=a+2` displays its value without a slider. Graphable objects retain
  visibility controls, including while hidden. Extra graph color controls were
  deliberately deferred.
- “Saved on this device” is removed. Angle mode is an exclusive Radians/Degrees
  selector. Mathematical input remains locally bundled DesQuill.
- Function shorthand accepts an unambiguous atomic argument, including `sinx`
  and `sinx^2` (meaning `sin(x^2)`). Compound products need parentheses; unrelated
  longer identifiers are not split. Explicit-parentheses input is unchanged.
- **Fraction / exact** recognizes bounded rational approximations, simple
  source-supported square roots and π multiples. It uses `≈` and does not claim
  arbitrary floating-point values have exact symbolic forms.
- Backspace edits content first; from an empty cell it moves backward with the
  caret at the previous cell's end. Empty rows/tables can be removed naturally.
  Focus into existing cells is synchronous so repeated Backspace progresses;
  newly created rows defer focus until rendered. One usable blank expression
  always remains.
- Calculator Help uses three concise topics with one open at a time.

## Window and Practice

All four edges and all four corners resize the floating window; the lower-right
handle is clearer. Header dragging, keyboard geometry controls, device-local
geometry, Reset window and narrow-screen overlay remain. Practice never reflows.

No leave-confirmation component previously existed. Escape while reading now
opens a small confirmation; another Escape confirms leaving. Cancel and Leave
session are explicit. Utility dialogs consume Escape first; editable inputs and
Calculator do not trigger it. Held Escape cannot accidentally run both steps.
The existing mouse Exit action continues saving/leaving directly.

No question-rendering conversion, study-schema migration, calculator-state
migration, new dependency, or reset/archive change. Derived fit results and point
inspection UI remain transient; both engine workspaces still save with sessions.

## Verification boundary

See `calculator-verification.md` for automated results. Live Desmos tests used
only synthetic math in a separate browser profile. They checked native tables,
quadratic and exponential `~` fits, custom sine-basis fitting, actual `sinx`
typing, fraction/decimal toggling, graph-local `(π/2,1)` inspection and native
curve dragging. While the trace drag was held, Desmos displayed the moving
coordinate `(2.59,0.52404)` beside the curve; that temporary label disappeared on
release. Offline retains its last single trace until cleared or replaced.
Exhaustive native gesture equivalence is not claimed.

Observed native parameters:

| Synthetic case                | Official Desmos                    | Offline                                       |
| ----------------------------- | ---------------------------------- | --------------------------------------------- |
| x=1,2,3,4; y=x²               | a=1, b=0, c=0                      | same cleaned display; raw QR residue retained |
| x=0,1,2,3; y=1,2,4,9; a·bˣ    | a=0.888120061686, b=2.160827144028 | same within checked displayed precision       |
| y=2 sin(x)+3 at five x values | a≈2, b=3                           | same QR result within numerical tolerance     |

General nonlinear fits, exact CAS algebra, arbitrary symbolic recognition,
editable table headers, full list comprehensions and Offline Undo remain outside
this pass. No claim is made to reproduce proprietary optimization heuristics.
