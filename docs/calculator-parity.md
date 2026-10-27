# Manual Desmos comparison — 2026-10-27

Reference: current https://www.desmos.com/calculator through its normal UI, using
original synthetic math. No private question data, account, or proprietary source
was used. The embedded API was checked against official documentation and mocked
in automated tests; no user key was available for a live-key integration check.

| Task exercised                           | Reference observation                                     | Offline result / difference                                     |
| ---------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------- |
| sqrt then 81                             | Structural root, result 9                                 | DesQuill root and result 9, browser-tested                      |
| 1/2, Right                               | Structural fraction, result 0.5                           | Corresponding structural operation; combined fractions tested   |
| sin²(π/2)                                | 1 in radians                                              | Same numeric result and power notation                          |
| Subscript cursor exit                    | Right exits x₁/y₁ structures                              | Same navigation; extra operator breakouts configured            |
| x₁/y₁ lists, y₁~mx₁+b                    | m=3, b=1, R²=1 for [1,2,3]/[4,7,10]                       | Same fit; list operations and points tested                     |
| Noisy exponential, Log Mode off          | x=[0,1,2,3], y=[1,2,4,9]: a≈0.88812, b≈2.16083, R²≈0.9989 | Original-y solver matches checked displayed precision           |
| sec(0), cot(π/4)                         | 1 and 1 in radians                                        | Same results                                                    |
| sin⁻¹(1)                                 | π/2 radians, 90 degrees                                   | Same notation and units                                         |
| arccot(-1), degrees                      | 135                                                       | Same branch; tested                                             |
| Type table                               | Table with unused numbered columns                        | Same command and stable unused suffixes                         |
| Table Tab/Enter/Left                     | Tab crosses columns; Enter advances within column         | Corresponding navigation, with text caret inside cells          |
| q=1                                      | Parameter with slider tools                               | Slider retained; custom ranges/animation omitted                |
| Enter then Backspace in blank expression | Deletes empty object, returns focus                       | Same neighbor-focus and blank-row behavior                      |
| Empty-table Backspace                    | Moves toward its editable header first                    | Offline removes an entirely empty table directly; fixed headers |
| Edit list → Delete All                   | One blank expression, Undo offered                        | Brief confirmation clears active engine; no offline Undo yet    |

Mouse cursor positioning, selection and structural deletion use upstream DesQuill;
this is not exhaustive equivalence with every current Desmos input rule. Completion
uses mathematical autocommands/operators rather than an IDE menu. Advanced commands
and every inverse-function boundary were not individually compared live. Local
numeric/domain tests cover the supported subset. General feature parity is not claimed.
