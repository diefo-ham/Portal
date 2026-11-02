# Focused SAT finite systems

Implemented 2026-10-29 in the Offline Calculator. No new dependency, provider,
storage format, or practice UI is involved. Coordinate equations retain their
graphs and now expose supported simultaneous solutions in the existing outputs
and graph inspection.

## Solver model

`finiteSystems.ts` supplies bounded rational-polynomial elimination, separate
from `regression.ts` and the UI. `workspace.ts` routes connected scalar `=`
equations in unknown single-letter parameters to it. Ordinary acyclic named
definitions and functions are expanded using the existing dependency machinery.
Repeated symbolic assignments and nonlinear cyclic assignments can form systems;
ordinary circular affine definitions continue to report their existing errors.

For `~`, the AST must describe two explicit, equally sized, flat literal lists.
Lists carrying unknowns on both sides are exact relations. A nonlinear literal
vector involving multiple unknowns, such as `[a+b,a*b]~[5,6]`, is also an exact
system. Purely numeric observations against an affine model retain least-squares
fitting, including inconsistent observations. Named data lists, generated ranges,
table regression, statistical templates, and models involving data-column
dependencies retain their fitting paths. This is a deliberately structural
distinction; the calculator cannot infer a word problem's unstated assumptions.

The algebra uses rational coefficients for decimal literals, arithmetic, and
division. It substitutes only constant nonzero linear pivots, splits common
variable factors into zero/nonzero-polynomial branches, and intersects remaining
univariate polynomials using rational polynomial GCDs. The existing real scalar
root isolator supplies remaining real roots. Every isolated candidate is checked
against the original equations, denominator domains, and parameter bounds.
There is no multivariable optimizer or acceptance of least-squares minima.

When substitution stalls, a connected component with two remaining variables
and polynomial degree at most four per equation can use a Sylvester resultant.
Its determinant uses exact rational polynomial arithmetic, no symbolic pivot
division, an at-most-eight-row matrix and at most 256 subset states. Resultants
and intermediate products must stay within degree eight and the existing term
and coefficient budgets. A nonzero eliminant is passed to the existing scalar
real-root isolator, then every real fiber is back-substituted. Approximate fibers
are checked numerically rather than intersected by exact GCD over rounded
coefficients. Candidates that violate an original equation or denominator guard
are discarded before quantities or shared parameters are computed. The existing
relative equation tolerance is `1e-9`; approximate denominator zeros use an
evaluation-magnitude-scaled machine tolerance. Numerically equal vectors are
deduplicated without merging swapped ordered pairs.

For degree-three-or-higher scalar eliminants, a Cauchy root bound must fit the
existing scalar isolator's radius of `1e6`. Otherwise the system explicitly
reports unsupported bounded elimination, never a truncated list of roots.

Representative results:

| System                       | Real ordered solutions                           |
| ---------------------------- | ------------------------------------------------ |
| `a+b=5`, `ab=6`              | `(2,3)`, `(3,2)`                                 |
| `a^2+b^2=25`, `ab=12`        | `(-4,-3)`, `(-3,-4)`, `(3,4)`, `(4,3)`           |
| `y=x+1`, `y=x^2-3`           | `((1−√17)/2,(3−√17)/2)`, `((1+√17)/2,(3+√17)/2)` |
| `x^2+y^2=1`, `xy=1`          | No real solution                                 |
| `x^2+y^2=25`, `2x^2+2y^2=50` | Free real conic family                           |

`x/y` equations are solved independently of the current viewport and continue
to render their existing graphs. Verified finite solutions supply inspection
intersections, including implicit/implicit pairs. Inspection clips these points
to the visible window, without changing the algebraic result. Coordinate values
are not published as global scalar definitions. Existing simple scalar bounds,
such as a separate `x>0` row, filter finite coordinate solutions too.

## Identifiability and results

- **Determined:** one verified finite solution vector; its values can be reused.
- **Multiple:** all supported real ordered solutions are displayed. Only parameter
  values shared by every solution are published globally.
- **Partial:** a free family remains but some parameters are invariant. Only those
  invariants are published; the others are described as not uniquely determined.
- **Underdetermined:** no individual parameter is invariant across the valid
  families. No arbitrary scale or sample vector is published.

Derived scalar expressions are reduced over the supported branches. For
`a+b=5`, `ab=6`, evaluating `a+b` gives 5, while `a` gives `[2,3]`.
For `a+b=5` alone, `a+b` still gives 5 but `a` reports that the quantity is not
uniquely determined. Rational invariants also require a provably valid denominator.
Free-family feasibility uses affine interval bounds, not samples.
Proportional conic equations are classified using an exact quadratic
discriminant: a real curve is a family, an empty conic has no real solutions,
and a conic reduced to one real point is solved as a discrete vector. General
shared-factor curve intersections remain unsupported unless existing factor
splitting/substitution exposes their families. Quantity reduction on implicit
families is conservative and may explicitly report unsupported algebra.

## Percentage relationship

```
[a,a,c] ~ [230% of b,60% of c,p% of b]
```

Without restrictions, the zero branch `a=b=c=0` permits arbitrary `p`.
The calculator shows one representative fit (`a=2.3, b=1, c=3.8333…,
p=383.3333…`) labelled "Representative fit; parameters are not unique." Treat
`p` as meaningful only once a nonzero `b` is assumed, as below.

Either append `{b>0}` or add the separate row `b>0`. Then the result is:

```
p = 1150/3
a, b, c not uniquely determined; free solution family.
```

This is `383 1/3`, approximately `383.3333333333`. Negative nonzero scale bounds
work too. `{b>=0}` retains the degenerate ambiguity. Fixing `b=0` determines
`a=c=0` while leaving `p` free. Fixing `b=6` determines all remaining parameters.
No positivity assumption is invented. `!=` syntax was not added; use existing
strict comparison bounds where appropriate.

## Compatibility and verification

Focused unit coverage is in `tests/finiteSystems.test.ts`. It covers the actual
percentage syntax and editor round trip, positive/negative/inclusive scale
bounds, separate restriction rows, zero branches, multiple product/sum solutions,
squares, rational denominators and negative powers, derived invariants, genuinely
free quantities, tiny pivots, incompatible equations, and unsupported elimination.
Explicit compatibility cases cover table, polynomial, constrained noisy, and
affine numeric-list fitting. Existing scalar, function, graph and regression tests
remain in the suite. The former rejection assertion for this SAT example was
updated to assert its new degenerate-family result.

`npm test`: 217 passing tests, including 33 focused finite-system tests.
`npm run build`: passes (existing large-chunk warning). The finite-system,
restriction, affine and correctness browser suites pass all 15 checks. Browser verification
includes the coupled circle/product branches, rational holes, conic families,
coordinate graphs, inspection intersections, and viewport independence, alongside
the previous percentage and statistical fitting workflows. The circle/product
and line/quadratic captures were visually checked against their reported pairs.
Synthetic browser
captures stay in ignored `private-data/inspection/`; no real question exports or
browser profiles are added.

## Concrete limits

- At most five unknowns, twelve equations, degree eight after expansion, powers
  through four (and reciprocal powers through negative four), 128 polynomial
  terms, 32 branches and a bounded recursive work budget. Existing AST limits apply.
- Remaining coupled components must have two variables, degree at most four per
  equation and bounded degree-eight resultant arithmetic. For example,
  `x^4*y+y^2=1`, `x*y^4+x^2=1` exceeds this pass. More than two coupled
  variables, such as `ab+bc=1`, `ac+bc=2`, `ab+ac=3`, remain unsupported.
- No general multivariate factorization, arbitrary statistical
  nonlinear fitting, transcendental parameter systems, complex roots, or exhaustive
  periodic solving. Scalar root isolation retains its existing degree/search limits.
- Nonlinear or coupled bounds on free families are rejected. Free families with
  approximate irrational elimination coefficients are conservatively unsupported.
  Bounds or nonconstant denominator guards on an implicit conic family are also
  unsupported; for example, `x^2+y^2=25{x>0}` with a duplicate circle equation.
  Nonproportional shared factors such as `(x+y)*(x-y)=0`,
  `(x+y)*(x-2y)=0` require unsupported factorization.
- Acyclic assignments remain definitions; write a finite literal list or connected
  equations to express simultaneous relationships. Separate `~` rows are not
  combined into a joint system. Two or more coordinate `=` rows are also treated
  as simultaneous equations; their graphs remain available even when their
  joint system is unsupported or has no real solution.
- Derived invariants are recognized by polynomial reduction and proportional
  rational numerators/denominators, not by general symbolic equivalence. Unsupported
  quantity reductions and unproved quantity domains report explicit limitations
  rather than asserting nonidentifiability.
