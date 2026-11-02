# Offline expression domain restrictions

Trailing braces on scalar expressions, named expressions/functions, and explicit
graphs accept `<`, `<=`, `>`, `>=`, chained bounds, comma conjunctions, and repeated
brace groups. For example, `f(x)=2x+1{-3<=x<=4}` restricts the entire function body.
Conditions may refer to defined constants and numeric function calls.

`restrictionSyntax.ts` shares only brace/comparison grammar. For ordinary
expressions, `math.ts` builds validated conditional AST nodes whose false branch
is undefined (`NaN`). For `~` rows, `relations.ts` continues to interpret braces as
fitted-parameter bounds. Domain restrictions do not become parameter constraints.

Dependency collection traverses both the expression and its conditions. Named
function expansion substitutes ASTs directly, preserving restrictions, lexical
arguments, and circular-dependency checks. Undefined values propagate through
downstream arithmetic and function calls.

The existing bounded graph sampler receives undefined values outside the domain,
refines mixed valid/invalid intervals, and leaves separate paths at domain gaps
and discontinuities. Inspection and tracing use those same restricted evaluators.
No endpoint-marker subsystem or graph UI redesign was added; inclusive/exclusive
boundaries are exact in evaluation and approximate to sampling resolution visually.

Deliberate limits: postfix restrictions must end the expression body. Nested
postfix expressions, piecewise alternatives, arbitrary Boolean logic, equality
conditions, and list-valued conditions are not supported. Existing bounded
sampling and numerical point-search resolution still apply.

Validation: 85 Calculator unit tests (151 total unit tests), 34 Calculator browser
tests, and the production build pass. Visual QA covers the restricted line,
bounded parabola, square root starting at x=1, constant-driven line, and a
regression constrained by `{m>=0}`. Captures stay in ignored
`private-data/inspection/domain-*.png`.
