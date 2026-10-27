# Floating calculator follow-up — 2026-10-27

Current stabilization changes and live-key verification are documented in [Calculator stabilization](calculator-stabilization.md); those details supersede earlier interaction limits below.

## Desmos is primary; Offline is local fallback

- With a configured key and no explicit saved engine choice, opening Calculator
  selects Desmos. This selected tab is the request to load the official API.
- A saved explicit Offline selection wins, including after close/reopen or resume.
  No Desmos script/frame is mounted while Offline is selected, and there are no
  availability probes or connectivity polling. Reading `/calculator-config.json`
  is a local request to the portal, not to Desmos.
- Both engine buttons always exist and remain enabled. With no key, Offline is
  initially selected; choosing Desmos explains the configuration requirement.
- Script errors or the 6.5-second deadline stay in Desmos with Retry / Use Offline.
  Selecting Desmos again after failure retries once. Switching away aborts the
  frame's work. Reconnecting never switches engines or starts a request.
- An already loaded Desmos instance is retained if the browser reports offline;
  it can continue working as far as the hosted calculator itself allows. Returning
  to Desmos after switching engines creates a new instance from saved opaque state.
- Keys still use `.env.local` / `VITE_DESMOS_API_KEY` or local runtime configuration;
  see [setup](calculator-providers.md). No key is checked into this repository.

The official iframe supplies its own expression editor, regressions, tables,
sliders, POIs, coordinate labels and tracing. `pointsOfInterest`, `trace` and
`customRegressions` are enabled using documented API options. No Offline parser
or fitter sees official expressions. No SAT question content is passed to it.

## Floating utility window

Calculator is rendered into a body portal as a fixed, **nonmodal** window.
Practice's question/answer layout, width and padding never change when it opens.
There is no backdrop and clicking Practice does not close Calculator.

- Drag the title region to move it. Controls and math content do not drag it.
- Drag the right edge, bottom edge, or bottom-right corner to resize freely.
- Keyboard: Tab to **Move calculator** or a resize handle; arrows change position
  or dimensions by 10 px, Shift+arrows by 40 px. Focus remains visible.
- **Reset window** restores useful default geometry without clearing math.
- Expand/Reduce and modal focus trapping were removed. Tab can return to Practice;
  keyboard events inside the window remain isolated. Closing restores the question
  or completed-results trigger's focus. Official Desmos keeps its native keyboard
  handling inside the iframe; the portal Close control remains reachable by Tab.
- Default width is 58% of usable viewport width, capped at 760 px; default height
  is up to 590 px. Initial placement is right-aligned with a 24 px margin and
  approximately 92 px from the top, then clamped.
- Desktop minimum is 440 × 360 px, or the available size on a smaller viewport.
  Maximum size is the usable viewport minus an 8 px margin on each side. The
  scrollbar width is excluded from usable width. Browser resizing reclamps it.
- Below 620 px, the window becomes an inset, viewport-sized overlay. Free dragging
  and resize handles are suppressed. Expressions and graph stack when the actual
  calculator width is below 680 px; wider windows use side-by-side math/graph.

Geometry is a **device preference**, stored under `sat-calculator-window-v1` in
localStorage. It is independent of sessions, math history and reset archives;
study reset does not erase it. Invalid/nonfinite/stale geometry is discarded or
clamped. The same recoverable geometry applies to completed-session workspaces.

## Immediate Clear

Clear acts immediately on the selected engine, with no confirmation. Offline
returns to radians, the default graph viewport and one blank expression; all
tables, lists, fits and sliders disappear. Desmos calls official `setBlank()`.
The other engine's saved work and all SAT study/session data remain intact.
Offline has no Undo yet.

## Offline graph-local inspection

- Click a function curve to place a temporary trace point. Drag along the curve
  to update its coordinates, without changing expressions. With a curve selected,
  Left/Right on the focused graph moves the trace; Escape clears it.
- Drag empty graph space to pan. Zoom/Fit/Square axes remain unchanged.
- **Inspect points** reveals numerical roots/intercepts/intersections/extrema as
  subtle graph-local marks. Hover, focus or select a point to reveal one attached
  coordinate label. No detached coordinate legend/list is required or displayed.
- One label is shown at a time, clamped inside the graph. It is hidden when its
  actual point lies outside the window. Selecting empty space dismisses it.
- For supported explicit points `(a, f(a))` (or `(a, expression)`), where `a` is
  a directly defined scalar slider, dragging changes the actual parameter and
  evaluates the second coordinate. Arrow keys on the point adjust `a` by 0.1
  (Shift: 1). Other expressions linked to `a` update normally and the value saves.

Temporary traces never add expressions or change slider values. Explicit points
use separate graph metadata and a parameter-update callback. Tables/list points
remain mathematical data, not draggable arbitrary coordinates. Implicit/vertical
curve tracing and arbitrary constrained/two-dimensional draggable points are not
implemented; native Desmos provides its richer interactions.

## Offline regression additions and limits

Existing linear/quadratic/cubic QR fits and original-y exponential least squares
are preserved. Added bounded custom polynomial forms through degree three,
including `y_1 ~ m x_1` and `y_1 ~ a x_1^2 + c`, with user-chosen distinct
single-letter parameters. Terms can be reordered; omitted terms stay zero.
Sparse designs are scaled without centering, then solved with QR and conditioning
checks so centering cannot introduce unwanted terms. Fitted parameters, R², RMSE
and residuals still use original y values.

This is not a general nonlinear optimizer. Arbitrary custom nonlinear fits,
optimizer starting guesses/constraints, exact proprietary convergence rules and
advanced residual tools remain native Desmos features. Offline exponential fits
still require positive y and have a bounded rate search. Numerical graph sampling
and POI searches remain approximate; they do not prove every solution is found.

## Compatibility and scope

No calculator/session database schema migration, new dependency, or license change.
Existing Offline text/LaTeX state and opaque Desmos state remain separate in the
same version-1 session workspace; reset/archive behavior is unchanged.

Checklist utility labels and skill phrases use sentence case; established SAT
domain names retain their capitalization. The same labels feed options and
collapsed summaries/tooltips. Imported metadata, taxonomy keys and distinctions
between skills are unchanged. Question rendering/import conversion is untouched.

See [verification](calculator-verification.md) for actual test coverage and limits.
