# Offline Calculator relation and graph correctness pass

The relation dispatcher checks evaluated shape and dependencies, not just a `~`
template. Known paired x/y lists retain the existing polynomial, exponential and
affine custom statistical fit paths. Generated expressions and function lists
contribute elementwise residuals to a scaled QR parameter fit. Scalars broadcast
over lists; incompatible lengths and nested lists fail explicitly.

Named functions and expressions retain unresolved single-letter scalar
parameters. Dependency analysis follows definitions transitively and respects
each function's argument scope. Relation analysis expands definitions as bounded
ASTs, preserving multiplication, arguments, circular-definition checks and free
coefficients. Definitions with pending parameters display them without evaluating
a made-up graph. Unique solutions become available to dependent expressions;
multiple solutions are shown together and an `=` equation does not silently
assign one branch. A `~` regression always yields one parameter set in the reference calculator, so
when it has several solutions all of them are still listed, but other rows use the
one closest to the reference calculator's starting guess of 1 (`x_1^2~5` gives `x_1 = +√5`; ties go
to the larger value). Restrictions such as `{n<0}` narrow the choice first.

Scalar relations with one free parameter use bounded rational-polynomial algebra
(linear/quadratic equations solve directly), followed by original-expression
domain checks. Other expressions use bracketed numerical roots, including
even-multiplicity candidates, with residual verification and deduplication.
Radians and Degrees use the same evaluator as ordinary expressions. The default
numerical trig interval is `[0, 2π]` or `[0, 360]`; other numerical relations use
`[-1000, 1000]`. Explicit bounds replace the corresponding endpoints. The UI
states the search interval. Higher-degree polynomial search uses a bounded
Cauchy radius, capped at one million. Polynomial roots are isolated between
successive derivative roots rather than a uniform grid: an even number of roots
inside one grid cell can no longer hide sign changes. Coefficients are normalized,
critical zeros are handled once for repeated roots, and candidates are refined
locally against the original expression before residual and domain checks.
Refinement is bounded and accepts only improvements, avoiding expansion
cancellation for nearby roots far from zero. X-only polynomial equations and
their Inspect Points use the same isolation and verification in the graph window.
Other numerical searches are finite, with at most 80 roots;
they do not claim all real or complex solutions or symbolic periodic families.

Relation-only `{...}` suffixes accept `<`, `<=`, `>`, `>=`, comma conjunctions,
chained bounds such as `{0<n<=5}`, and multiple brace groups. Each comparison
must put one fitted parameter against a finite defined scalar, for example
`{n<k}` when `k` is defined. Coupled constraints and general Boolean logic are
unsupported. Algebraic roots are filtered by bounds. Affine list/data fits solve
box-constrained least squares by enumerating active bounds and solving the
remaining system with QR. Open bounds whose excluded endpoint is the only
least-squares minimum report that no fitted minimum satisfies the restrictions.

Implicit equations structurally affine in x/y normalize to explicit or vertical
lines and reuse existing Inspect Points. Complex implicit curves retain contour
rendering and the safe no-automatic-points fallback. The explicit sampler stops
subdividing wholly invalid intervals after a bounded probe, leaving enough
budget to draw one-sided domains. Mixed valid/invalid intervals still refine
their boundaries without connecting across domain gaps or poles.

Steep intervals overlapping the visible y-window may refine below the ordinary
pixel-width cutoff, with a depth bound of 48 and the existing shared evaluation
budget. This preserves narrow high-growth crossings at large zoom ranges.
Finite visible samples also keep neighboring overflowing samples from erasing
the transition. Offscreen pruning and discontinuity checks remain in place.

Coordinate parentheses are multiplication: `8x(x^9-x^8+11)` means
`8*x*(x^9-x^8+11)`, and `y(y+1)` also multiplies. Other named calls, including
`f(x)`, `g(t)` and built-ins, retain function syntax. The workspace supports
`b c` and compact `bc` when both single-letter scalar names are defined, with
an explicitly defined `bc` taking priority. Unknown multi-letter names are not
arbitrarily split; function names are not scalar product factors. Parentheses
after other names, such as `b(c)`, retain named-call syntax; use `b c` or `b*c`
for multiplication. Polynomial fit export omits dots only between numeric
coefficients and x powers (`2x^2+4x-6`); custom and exponential export keep their
existing explicit multiplication.

Expression-row Enter inserts a fresh blank row immediately after the current
row, including when a row already exists below it. DesQuill's structural
navigation remains intact; table Enter retains its own cell/row navigation.

Exact finite nonlinear parameter systems now have a separate bounded algebraic
path; see [SAT finite systems](calculator-finite-systems.md) for routing,
identifiability, constraints, examples and concrete limits. Statistical list/value
fits still require parameters to enter linearly outside the existing templates.
Separate scalar `~` rows are not combined into a joint system. Coefficient
identities without a supplied domain and a universal implicit critical-point
engine remain unsupported. Existing expression, expansion and list-size safety
bounds remain in force.

Focused coverage is in `tests/calculator.test.ts` and
`tests/browser/calculator-correctness.spec.ts`, alongside all pre-existing
Calculator browser suites.
