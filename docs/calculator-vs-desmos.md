# Offline calculator vs official Desmos

Run on 2026-11-03 with Desmos API v1.12.0 and the Offline engine in this repository.
Rerun with `node scripts/calculator-vs-desmos.mjs` (needs `DESMOS_API_KEY` in
`.env.local` and internet; local only, never in CI). Cases live in
`scripts/calculator-corpus.mjs`. Each case is given to both calculators and the
results are compared: numbers to nine digits, fitted parameters to five.

## Result: 125 cases, 11 differences

| Area | Cases | Same result |
| --- | --- | --- |
| Values (arithmetic, roots, logs, trig in both angle modes, statistics, lists, edge cases) | 70 | 67 |
| Functions sampled at several x values (including domain edges and undefined points) | 17 | 15 |
| Regression parameters (linear, quadratic, cubic, exponential, logarithmic, scalar) | 9 | 7 |
| Syntax accepted or rejected | 20 | 16 |
| Intersections, zeros and tangents (checked against the known answers, since Desmos cannot report them through its API) | 9 | 9 |

Both calculators agree on 0^0 = 1, division by zero, square roots of negatives,
rounding rules, modulo of negatives, and every ordinary SAT-style computation.

## Where Offline falls short

1. **Factorial** `5!` is rejected.
2. **Real roots of negatives through a fractional power.** Desmos gives `(-8)^(1/3) = -2` and
   `x^(2/3)` at `x = -8` as `4`; Offline reports undefined. `cbrt(-8)` works.
3. **`nCr(5,7)`** is an error in Offline; Desmos gives `0`.
4. **Piecewise functions** written `{x<0:-x,x}` are rejected. Domain restrictions such as `{x<0}` work.
5. **Nonlinear regressions** (power `a x^b`, sinusoidal `a sin(b x)`) are rejected because Offline
   only fits models that are linear in their parameters. Desmos fits them.
6. **Nonlinear implicit inequalities** such as `x^2+y^2<=9` are rejected (only straight-line
   inequalities shade).
7. **Lists of points** `[(1,2),(3,4)]` are rejected.
8. **Points with an undefined variable** `(t,t^2)`: Desmos offers a slider; Offline says to define `t` first.
9. **Summation notation** is not supported.

## Not covered by this run

Drawing and interaction (graph rendering, tracing, dragging, zoom), the table editor,
sliders, keyboard shortcuts, and speed. These need side-by-side visual checks.
