# Calculator integration decision

Investigated official Desmos material for this first implementation on 2026-10-25.

- The [official API documentation](https://www.desmos.com/api/v1.13/docs/index.html) supports constructing an embedded `Desmos.GraphingCalculator` with an API key. Its ordinary example loads JavaScript from Desmos, introducing a network dependency.
- The [official API plans article](https://help.desmos.com/hc/en-us/articles/49078363315725-API-Plans-for-Commercial-Use) explicitly describes self-hosting as supporting operation without a network connection. That article places self-hosting in its Enterprise offering; Starter uses Desmos-hosted delivery. Personal-use availability and applicable license terms should be confirmed directly through the [Desmos API page](https://www.desmos.com/api) before integration.

Decision: do not copy, iframe, cache, or scrape the public calculator. No assumption that an ordinary API key grants an offline redistribution license. The MVP has a small local arithmetic panel in `src/calculator/Calculator.tsx`; its local UI state and arithmetic are independent of question, attempt, import, and storage logic. It supports addition, subtraction, multiplication, division, and powers, with explicit undefined results. It is not a graphing solution or an official SAT assessment-mode replica.

Next step: determine whether an authorized personal offline distribution is available from Desmos, or evaluate a locally bundled graphing engine and its license/accessibility. Keep that choice behind this component boundary, preserve keyboard access, and test with the network disabled. Calculator state may later get its own adapter if session-level graph history is useful.
