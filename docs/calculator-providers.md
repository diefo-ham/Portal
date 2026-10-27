# Calculator providers and input

Updated 2026-10-27. The official online API and the local offline engine share one
Practice surface, with separate session-owned workspaces. Question, attempt,
review and timer rules are independent of the calculator provider.

## Official Desmos configuration

Obtain your own browser-side API key at https://www.desmos.com/my-api following
the [official API documentation](https://www.desmos.com/api/v1.12/docs/index.html).
Copy `.env.example` to `.env.local`, set `VITE_DESMOS_API_KEY=your-own-key`, then
restart Vite or rebuild for `npm start`. The key is browser-visible by design;
there is no backend. `.env.local` is ignored by Git. Do not use a demonstration
key as your own key.

An administrator can alternatively supply a local `/calculator-config.json`
containing `{ "desmosApiKey": "your-own-key" }`. The build-time key takes
precedence. The checked-in runtime configuration is blank.

Without a key, Offline opens immediately. With a key, Desmos loads only when
Calculator opens in that mode. A local bridge instantiates official API v1.12
with documented `getState`, `setState`, `setBlank`, change observation, focus and
destruction methods. No proprietary hosted bundle is redistributed, reverse
engineered, or placed in an offline cache.

Loading has a **6.5-second deadline**. Script/constructor failure or timeout stays
inside the selected Desmos tab with Retry and Use Offline actions. The Desmos tab
always remains selectable, including without a key. Selecting it after failure
starts a fresh attempt. Use Offline interrupts loading immediately; there are no
background probes, reconnect listeners, or periodic retries. A loaded Desmos
instance is not destroyed merely because the browser reports an internet outage. `navigator.onLine` alone never declares the
API available. Official Desmos uses its own readable presentation inside the
portal's themed frame; this is not a claim to reproduce the restricted SAT app.

## Privacy and local operation

Offline uses local JavaScript, fonts and storage, with zero external requests.
Its configuration request is to the running local server only. The portal keeps
its restrictive network policy; a local iframe has the separate policy needed
for official Desmos. Only the API key and opaque calculator state cross that
bridge. No question content, PDFs, session identifiers/names, answers or study
history are supplied to Desmos.

## Structural editor and notebook workflow

**DesQuill** replaces the text-input/preview pair. This is the publicly released
MPL-2.0 formula editor, bundled from revision
`de33da1c698541be6d1252948e55983b2e81055e`. It does not replace our mathematical
engine. Unmodified source, build, provenance and licenses live in `vendor/desquill`;
`npm run build:editor` regenerates it using esbuild and Sass. It needs no jQuery.
Added production dependencies are `@fluent/bundle` (Apache-2.0) for spoken-math
localization and `@lukeed/uuid` (MIT, including csprng). Production notices include
the upstream Flux and Underscore licenses. Source is available at the pinned
upstream revision and in this project.

- `sqrt`, `/`, `^`, `_` create structural roots, fractions, powers and subscripts.
- Arrows navigate structures; Up/Down at field boundaries move between notebook
  objects. Enter advances to the next object, creating one when needed.
- Autocommands recognize ordinary trig/inverse functions, log/ln, exp and abs.
  Functions use parentheses. Typing `table` creates a table.
- Backspace/Delete edits math first; in an empty expression it removes the object
  and focuses a neighbor. A usable blank expression always remains.
- Clear calculator acts immediately, clears only the active engine, and preserves
  the other workspace. Offline returns to default view/radians and one blank row;
  Desmos uses official `setBlank()`.

The editor supplies spoken math and ARIA feedback, stable control labels, and
visible focus. Assistive-technology acceptance remains useful. Math.js still
provides parsing/TeX and a bounded, explicit real-number AST interpreter provides
evaluation. Property access, arbitrary calls, units, matrices and unrestricted
assignment remain blocked. KaTeX is retained for fitted-equation output.

## Tables, lists and fits

Tables have stable `x_1`/`y_1` column names, then unused numbered names. Entering a
populated last row adds a blank row. Enter/Up/Down move in a column; Tab/Shift+Tab
move across rows; Left/Right cross cells at text boundaries. Enter/Tab beyond a
final blank row returns to expressions. Delete an empty row to remove it; delete
within an entirely empty table to remove the table. Two-column tab/comma pasting
is preserved. Incomplete rows report errors rather than silently dropping data.

Lists support `L=[1,2,3]`, `x_1=[1,2,3]`, `y_1=[4,7,10]`, scalar/list arithmetic,
elementwise functions, and `f(x_1)` for a defined scalar function. Paired lists
`(x_1,y_1)` plot points. Lists need compatible lengths. Lists or table columns can
feed these regression templates, using distinct unassigned single-letter parameters:

```text
y_1 ~ m x_1 + b
y_1 ~ a x_1^2 + b x_1 + c
y_1 ~ a x_1^3 + b x_1^2 + c x_1 + d
y_1 ~ a b^x_1
```

Fitted parameters become available to other expressions. These templates and the
existing Fit model selector use the same engine. Polynomial fits retain centered/
scaled QR least squares from ml-matrix, conditioning checks and stable evaluation.
Exponential fitting now minimizes **original-y SSE**: solve amplitude exactly for
each normalized rate (variable projection), then use a bounded coarse search and
golden-section refinement. Positive y and distinct x are required. This replaces
the earlier log-linear method; it is not Desmos's general nonlinear optimizer.

Fits expose coefficients, residuals (observed minus fitted), RMSE and R²:
`RMSE=sqrt(SSE/n)`, `R²=1−SSE/SST`, always on original y. Constant-y R² is undefined.

## Trig and graphing

Supported trig: sin/cos/tan/sec/csc/cot; asin/acos/atan/asec/acsc/acot and arc-name
aliases; `sin^-1(x)` for inverse sine and `sin^2(x)` for squared sine. Degree mode
changes both input and inverse output units. Domain/pole checks reject undefined
values. Inverse cotangent uses the 0–π branch, matching the checked reference.

Existing graph capabilities remain: simultaneous functions, vertical/implicit
equations, explicit inequalities, points, pan/zoom, Fit, Square axes, manual bounds,
numerical roots/intercepts/intersections/extrema, and coordinate inspection.
Adaptive paths break at detected discontinuities. Implicit curves use bounded
approximate contours. Numerical sampling cannot prove every solution was found.

## State and compatibility

`Session.calculator` remains version 1. Offline entries, angle and view stay in
their existing fields. Optional additions: expression `latex`, table `columns`,
selected `mode`, and opaque `desmos` JSON. Official state is checked for JSON
safety, size and depth only; no translation or proprietary field interpretation.
Structural LaTeX is the evaluation source when present. Legacy text opens
structurally without losing its engine representation. Legacy tables receive stable
identifiers on opening and save them with the next edit. No database migration.

Both engines survive switching, questions, close/reopen and resume. Completed Math
sessions expose Calculator workspace in results. New/repractice sessions begin
clean. Reset removes both with their sessions; the one-slot archive and full
backups preserve/restore both. Writes still debounce for 350 ms and flush on
close, exit, finish, visibility changes and unmount. Abrupt termination may lose
the final unsaved fraction of a second. API keys are configuration, not progress.

Native calculator keys never reach Practice: E does not bookmark, arrows do not
move questions, and Enter/Space do not submit. Desmos handles its own keys inside
the iframe. Closing restores question/result-trigger focus. The floating window
is nonmodal and allows keyboard focus back into Practice.

## Validation and remaining differences

Automated tests mock the documented official API boundary; they require no live
network. They cover success/failure/timeout/disconnection, switching, independent
state, completion, reset recovery, structural input, lists, fits, trig, keyboard
isolation, persistence, themes and responsive layouts. **No real API key was supplied**,
so the live embed with the user's key still needs acceptance testing. The public
Desmos calculator was used directly for [manual comparison](calculator-parity.md).

1. **Intentionally out of scope:** CAS, arbitrary precision, complex/matrix/calculus
   tools, accounts/cloud saves, animations, automatic cross-engine translation.
2. **Difficult but feasible:** arbitrary nonlinear fits, general implicit inequalities,
   special points on arbitrary implicit curves, piecewise/domain restrictions,
   advanced list indexing/broadcasting/comprehensions, polar/parametric families.
3. **Proprietary behavior:** optimizer initialization/heuristics, graph sampling,
   undocumented state internals and exact assessment behavior. No equivalence claimed.
4. **Future refinements:** offline undo/redo, editable table headers, slider ranges/
   steps, automatic function-argument insertion, structural table-cell math, more
   equivalent regression forms, optional on-screen keypad. Table cells remain text.

Conservative limits: 24 working entries plus a blank row, 200 table/list values,
1,200 characters per scalar source, 1,500 per structural source, bounded AST
depth/size, ±10¹⁰ graph bounds, 10⁻⁷ minimum spans, IEEE-754 numbers with 10-significant-
digit display. Desmos state is limited to 2 MB. The lazy local calculator is about
200 KB gzip JS and 21 KB gzip CSS; the initial study-screen load excludes it.


## Floating-window follow-up

See [floating window, connection rules and graph interaction](calculator-floating.md).
This supersedes earlier descriptions of a side panel or expanded modal.
