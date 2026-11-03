# Offline calculator vs official Desmos

Compared on 2026-11-03 with Desmos API v1.12.0 and the Offline engine in this repository.
Both comparisons are local only (they need `DESMOS_API_KEY` in `.env.local` and internet) and never run in CI.

- `node scripts/calculator-vs-desmos.mjs` gives 125 cases from `scripts/calculator-corpus.mjs` to both
  calculators and lists every disagreement (numbers to nine digits, fitted parameters to five).
- `node scripts/calculator-visual-vs-desmos.mjs --out <dir>` needs a build (`npm run build`). It draws 16 scenarios
  in both, in the same window, side by side.

## First run: 125 cases, 11 differences

Offline lacked factorials, real roots of negatives through a fractional power (`(-8)^(1/3)`,
`x^(2/3)` at a negative x), `nCr` with a size larger than the pool, piecewise functions, power and
sinusoidal regressions, curved inequalities (`x^2+y^2<=9`), lists of points and summation.

## After the fixes: 125 cases, 0 real differences

| Area | Cases | Same result |
| --- | --- | --- |
| Values (arithmetic, roots, logs, trig in both angle modes, statistics, lists, edge cases) | 70 | 70 |
| Functions sampled at several x values (including domain edges and undefined points) | 17 | 17 |
| Regression parameters (linear, quadratic, cubic, exponential, logarithmic, power, sinusoidal, scalar) | 9 | 9 |
| Syntax accepted or rejected | 20 | 20 |
| Intersections, zeros and tangents (checked against the known answers, since Desmos cannot report them through its API) | 9 | 9 |

What changed in Offline:

- `5!` factorials (whole numbers up to 170).
- A negative base with an odd-denominator exponent has a real value, as in Desmos.
- `nCr(5,7)` and `nPr(5,7)` are 0.
- Piecewise functions: `f(x)={x<0:-x,x}`, `y={x<0:1,0<=x<5:2,3}`. Without a final value the function is
  undefined elsewhere. Shown as a cases brace.
- Summation and products: `sum(n^2,n,1,4)`, `prod(n,n,1,5)` (up to 10,000 terms).
- Lists of points: `[(1,2),(3,4)]`.
- Regression models that are not linear in their parameters (`a*x^b`, `a*sin(b*x)`, `a*b^x+c`, ...), fitted by
  Levenberg-Marquardt from a fixed set of starting points, so the same data always gives the same answer.
  Equally good mirror solutions are shown with positive parameters and the smaller frequency.
- Curved inequalities such as `x^2+y^2<=9` or `x*y<=2` are shaded from the window (the edge is approximate);
  the boundary is dashed for `<` and `>`.

A point such as `(t,t^2)` with `t` undefined is not drawn until you press "Add t slider", which is how Desmos behaves too.

## Visual comparison

All 16 scenarios (parabola, two lines, line and absolute-value inequalities, circle inequality, circle and line,
ellipse, sine wave, piecewise, domain restriction, logarithm with reciprocal, rational function with an asymptote,
points, slider curve, fitted data, exponential decay) draw the same curves in the same positions as Desmos.
Differences are cosmetic: the Offline graph uses equal axis scales and a warm theme, and its `y` axis title can
overlap the top tick number.

## Not covered

Interaction (tracing, dragging, zoom, point-of-interest labels), the table editor, and speed on slow devices.
Desmos cannot report points of interest through its API, so these were checked against known answers only.
