# Offline expression and graph refinement

## Lists and dependencies

Ellipsis lists are lowered into mathematical RangeNodes before the safe AST
interpreter runs. Their values are generated at evaluation time, including when
endpoints depend on scalar definitions. They are not expanded into source text.
The existing Offline limit of 200 list elements applies before allocation.

Live checks against official Desmos v1.12 on 2026-10-27 confirmed:

| Input         | Result             |
| ------------- | ------------------ |
| `[1...10]`    | 1 through 10       |
| `[1...100]`   | 1 through 100      |
| `[1,3...11]`  | 1, 3, 5, 7, 9, 11  |
| `[5...1]`     | 5, 4, 3, 2, 1      |
| `[5,4...1]`   | 5, 4, 3, 2, 1      |
| `[1,3...10]`  | 1, 3, 5, 7, 9, 11  |
| `[1,3...9.1]` | 1, 3, 5, 7, 9      |
| `[1.5...4.5]` | 1.5, 2.5, 3.5, 4.5 |

The endpoint chooses the nearest number of steps, so the final value can exceed
the written endpoint. Zero steps and steps directed away from the endpoint are
rejected. Both comma-separated ellipsis variants and Unicode ellipsis are
accepted. Structural entry and paste round-trip through the same AST.
The [official Lists guide](https://help.desmos.com/hc/en-us/articles/4407889068557-Lists)
explains the ordinary ellipsis and inferred-step forms.

Named definitions now have transitive dependencies. A name depending on x is
evaluated with the current x and graphed, instead of being cached as a scalar.
Independent constants retain scalar results/sliders; explicit functions retain
their argument binding; undefined parameters and circular dependencies fail
clearly. Adjacent defined one-letter names multiply, while existing explicit
longer identifiers retain their meaning.

Official Desmos and Offline both graph `p=3x+4`, `v=x+5`, and `pv-2p+v`.
The resulting curve is `3x²+14x+17`. Live Desmos helper functions and Offline
unit tests agree at x = 2, 0, −2: 57, 17, 1. Changing either definition updates
dependent graphs. No point-specific evaluation is cached as a global constant.

## Graph interaction and layout

- The expression/graph divider drags horizontally on wide Calculator windows.
  The expressions stay at least 230 px wide and the graph region at least 240 px.
  Arrow keys move the focused separator; Shift takes larger steps; Home/End
  reach its limits. The preferred ratio is a device preference in localStorage
  (`sat-study-calculator-split`), independent of session history. Narrow windows
  keep the stacked layout and hide the separator.
- Equal unit scale is maintained on initial view, reset, pan, zoom, outer-window
  resizing and divider resizing. Manual bounds expand one axis enough to contain
  the requested window with equal units. Fit and Square axes controls are removed.
- Inspect Points supports toggle selection, multiple kept labels, empty-space
  clearing, and clearing on disable. Curve tracing remains separate. Explicit
  data points no longer receive a duplicate overlaid Inspect marker. The
  existing 22 px mouse and 30 px touch proximity rules remain.
- Coordinate recognition adds rational multiples of the square roots of
  2, 3, 5, 6, 7, 10, 11 and 13, with numerator/denominator bounded by 12 and a
  relative tolerance of 5e-11. Integers, rationals and π multiples take priority.
  Labels retain ≈ because numerical recognition is not symbolic proof.

## Small controls and persistence

Clicking the existing dot toggles visibility. Right click, a 500 ms long press,
Shift+Enter or Shift+F10 opens an eight-color palette. Escape/outside click closes
it. Color controls appear only for graphable entries; optional `color` integers
0–7 persist on those entries and travel with session backups/reset recovery.
Legacy entries without color use the existing automatic palette. No database
version change is required.

Blank rows retain their accessible names and cursor but no visible placeholder.
Calculator Help subtopics are indented slightly and keep one topic open.
The conversion button reads **Fraction**, with the existing conservative logic.

Viewport changes merge with the latest edited workspace, preventing resize or
engine-remount effects from overwriting an immediately typed expression.

## Limits

This does not add list comprehensions, indexing, nested lists, a full symbolic
algebra system, or advanced custom-color expressions. List-valued outputs keep
the previously supported contexts: numeric list arithmetic/function evaluation,
paired point plotting, tables and regressions. General nonlinear custom fitting
remains an official Desmos feature. The independent Desmos workspace/API boundary
is unchanged.
