# Offline calculator vs official Desmos

Compared on 2026-11-03 with Desmos API v1.12.0 and the Offline engine in this repository.
The app no longer includes Desmos (retired 2026-11-03, after this comparison). Both comparisons are local only (they need `DESMOS_API_KEY` in `.env.local` and internet) and never run in CI.

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
- Points and lists of points are values, as in Desmos: `a=(3,4)`, `a=[(3,4),(4,3)]`. Results show as chips
  (`(3, 4)` `(4, 3)`), and a point value plots. Supported: `a.x`, `a.y`, `a[2]`, `a[[2,1]]`, `a+(1,1)`, `2a`,
  `a/2`, `-a`, `mean(a)` (a point), `total(a)`, `length(a)`, `count(a)`, `join(a,(5,5))`, `distance(P,Q)` and
  `midpoint(P,Q)` (also against lists). `min`, `max`, `median`, `sort` and `stdev` of points are reported as
  not defined for points; `sort` is left out until it is confirmed against Desmos. Point variables plot but
  are not draggable yet.
- Regression in subscripted parameters: `[x_1^2+y_1+7,20x_1+100-y_1]~[7,0]` solves to `x_1=-10, y_1=-100`
  with `RMSE = 0`, as in Desmos. A unique exact solution of a `~` system is reported as a zero-residual fit.
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

## Second pass: lists, interaction and speed

More features a student might reach for were checked: list items by position (`L[2]`, `L[2...3]`, `L[[3,1]]`,
one-based, out of range is undefined), `sort`, `join`, `length`, `corr` and the hyperbolic functions. All were added and
agree with Desmos (80 value cases, 17 function cases, 9 fits, 9 intersection cases and 32 syntax cases: 147 in all).

Four syntax cases still differ, none of them on the SAT: definite integrals and filtering a list by a condition are
not supported; Desmos refuses `theta=2` and a bare `k` where Offline accepts them (Offline offers an "Add k slider").

`node scripts/calculator-interaction-vs-desmos.mjs` compares how the graphs move and how fast they are:

| Check | Offline | Desmos |
| --- | --- | --- |
| Mouse wheel, one notch in | view shrinks to 0.85 | 0.94 |
| Zoom "+" button | view shrinks to 0.7 | 0.5 (twice as close) |
| Drag 100 px | graph moves 100 px | 100 px |
| Six heavy curves (`sin(1/x)`, `tan(x)`, ...) while panning, mean frame | 16.7 ms (60 per second), worst 16.8 ms | 16.7 ms, worst 16.8 ms |
| Typing six heavy curves | 0.4 s | not comparable |

Points of interest in Offline (inspect mode) listed the right intersections, intercepts, zeros and minimum for
`y=x^2-4x+1` with `y=x-3`. Labels show more decimals than Desmos, for example `(0.2679491924, 0)`.

Known remaining differences, all small: zoom steps are gentler in Offline; sliders have no editable range or
animation (the range is -10 to 10 and widens to fit the value); the table editor supports pasting and a fit model
but was not compared screen by screen; Desmos draws its labels on a canvas and cannot be read through its API, so
labels were compared by value only.

## Not covered

Touch gestures, Desmos' on-screen keypad (Offline has none), saving and sharing graphs, and anything on the real
test app (Bluebook) that differs from the public Desmos calculator.

## After the comparison

Offline gained the zoom steps Desmos uses (the buttons halve or double the view, a wheel notch is 6%), and sliders
with an editable minimum, maximum and step plus play, pause, speed and animation modes (back and forth, repeat, once).
The comparison scripts stay in the repository as developer tools and still need a Desmos key in `.env.local`.
