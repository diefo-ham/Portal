# PAA Portal

The portal serves two tests from one codebase: the **SAT** and the **PAA** (Prueba de Aptitud Académica, College Board Puerto Rico y América Latina). The header toggle (**SAT ⇄** / **PAA ⇄**) swaps between them from anywhere. Everything below is what differs for the PAA. The study guide (`Guía de estudio PAA.pdf`, section "Estructura y contenido de la PAA") is the evidence for the test facts.

## How the PAA differs

| | SAT Portal | PAA Portal |
| --- | --- | --- |
| Parts | Reading & Writing, Math | Lectura, Redacción, Matemáticas, Inglés |
| Format | Adaptive digital modules | Linear and paper-style: 175 questions (Lectura y Redacción 70 in 80 min, Matemáticas 55 in 60 min, Inglés 50 in 40 min; see "The real test" below) |
| Questions | Four choices; numeric entry | Four choices; some Matemáticas questions ask the student to supply the answer |
| Scoring | Estimated SAT range from full tests | 200–800 per part and 10–40 per subpart, converted from the whole test. No penalty for wrong answers. **The portal does not invent a conversion.** |
| Calculator | Bundled Offline calculator | None: the guide says the problems do not need one |
| Spoiler protection | Active practice-test questions hidden | No such concept; questions import as `unknown` and nothing is hidden |
| Interface language | English | Spanish (Inglés questions stay in English, with Spanish explanations) |

What the PAA Portal shows instead of a score: percent correct and attempt counts for each part, each domain (Matemáticas uses the guide's four subscore areas: Aritmética, Álgebra, Geometría, Análisis de datos y Probabilidad) and each skill, with a "limited data" note under five attempts and a line saying it is practice accuracy, not a PAA score.

## The real test: what is sourced and what is not

- **Questions per part** (70 Lectura y Redacción, 55 Matemáticas, 50 Inglés; 175 in all), four choices each, some Matemáticas items answer-supplied, no calculator: College Board Puerto Rico y América Latina, [PAA revisada: Preguntas y respuestas](https://latam.collegeboard.org/wp-content/uploads/2017/10/PAA-Preguntas-y-Respuestas-Puerto-Rico-2017.pdf) (October 2017).
- **Times:** that 2017 document gives 75 / 60 / 50 minutes (3 h 5 min). The study guide (2018 onwards) gives 2 h 20 min for Lectura, Redacción and Matemáticas and 40 min for Inglés, and a 2024 [comparison of the SAT and the PAA](https://www.elnuevodia.com/suplementos/college-board/notas/cuales-son-las-diferencias-entre-el-sat-y-la-paa/) (a paid press release) splits that as 80 / 60 / 40 for 175 questions in 3 hours. The newer figures are used.
- **Order:** Parts 1–2 Lectura y Redacción, Part 3 Matemáticas, Part 4 Inglés (same article).
- **Not found:** how the 70 are divided between Lectura and Redacción, and where the answer-supplying items sit on the real test. The guide's own examples and practice sets put them after the multiple-choice items, so test mode does too.

## Test mode (Modo de prueba)

The PAA replaces the SAT's adaptive Practice Tests with a timed run that follows the real test as closely as the sources allow. It is its own small feature (`src/core/timedTest.ts`, `src/ui/TimedTest.tsx`), not a variant of the SAT engine, which depends on SAT sections, routing and score estimates.

- **Parts, each with its own clock:** Lectura y Redacción, then Matemáticas, then Inglés (the real test times each separately). The full test is the default; any combination works. The clock of a part starts when the part starts.
- **Locked once it ends:** a part ends when you finish it or its time runs out, and cannot be revisited. Inside a part you can skip, return, mark questions and open the overview (the toolbar's **Resumen**, or the question counter), a page like the SAT Practice Test's with a grid of answered and marked questions. **Enter** moves to the next question once one is answered; from the last it opens the overview. The progress bar follows the position in the part. Marks and answers of an ended part are frozen.
- **Break:** between parts nothing runs. A break screen says what comes next, and the next clock starts only when you start that part. (Whether and how long the real test pauses between parts was not found.)
- **No pause during a part:** the real test has none. Leaving (**Salir**) stops that part's clock so an interruption does not cost the test; coming back asks to continue.
- **No feedback**, and no penalty for wrong answers (as on the real test): unanswered questions count as incorrect. Everything is scored when the last part ends.
- **Setup:** parts, whether to use only questions not yet answered, how many questions, and the time for each part (shown in a small table; or no limit, which turns each clock into a stopwatch).
- **Order and size:** parts in PAA order; inside a part, the bank's own order, with grid-in questions last in Matemáticas (the guide does the same; the real test's order was not found). Whole readings are kept together, and the number is met exactly where readings can add up to it. Parts are weighted by their real sizes (70 / 55 / 50).
- **Time suggestions:** the real pace of each part (Lectura y Redacción 70 questions in 80 min, Matemáticas 55 in 60, Inglés 50 in 40) applied to the questions each part will have; with this bank's 67 / 45 / 42 questions the full test suggests about 77 / 50 / 34 minutes. Editable.
- **Results:** laid out like the SAT Practice Test's: a gauge with the counts (a part selector when more than one part was taken), strongest and weakest domain, "Rendimiento por parte" with the time used and allowed, domains and skills, and every question with its explanation. Answers count in the PAA's progress and review. There is no score, only percent correct.
- Test sessions stay out of the ordinary practice session lists, and an unfinished test does not put its questions under "left unanswered". Each test in "Tus pruebas" has a ••• menu (rename; delete, or cancel when unfinished). Deleting a result removes the entry and, unless the Settings option says otherwise, keeps the answers in the history. A test saved with a single clock (an earlier build of this feature) is read as one part.

## Grid-in answers

The guide's rules for answers the student supplies: positive numbers only (whole, fraction or decimal), at most four characters, no mixed numbers, no radicals; a decimal must be precise, so for 2/3 `.666` and `.667` count and `.66` and `.67` do not. `isCorrect` applies this to PAA questions: an answer matches an accepted form exactly, or is a decimal with at least three digits that is the accepted value cut off or rounded at that point. Negative answers are never correct. The SAT rule (equivalent values within 1e-9) is unchanged.

## Data: one record, two tests

`Question`, `Attempt` and `Session` carry `assessment` (`"SAT"` or `"PAA"`). Data stored before PAA support has no field and is read as SAT (`backfillAssessments`, applied whenever data is read or saved), so nothing is migrated destructively and old backups still load.

- **IDs cannot collide.** PAA internal IDs are `paa-<source ID>`; `parseQuestions` rejects a PAA question without that prefix and any SAT question that starts with `paa-`. Duplicate detection keys on `(assessment, source, sourceId)`, and a library refresh uses the same key. An internal ID that matches a different question rejects the whole import instead of overwriting.
- **Separate progress.** Screens receive a scoped view of the data (`scopeStudyData`): questions, answers, sessions, bookmarks and practice-test exposure for one test. Writes still go to the whole record. An answer keeps its own `assessment`, so history stays with its test even if the questions are removed.
- **Separate maintenance.** Reset progress, its recovery archive (`reset-archive` for SAT, `reset-archive-PAA`) and Remove my questions act on the current test only. Erase all data on this device is the one action that covers both, and says so.
- **Preferences** (theme, timer default, explanations, and whether deleting a session also removes its answers) are per browser and shared. The last test used is `sat-last-assessment` (it keeps the `sat-` prefix so Erase all data removes it); a fresh browser opens the SAT. Hash routes `#/sat` and `#/paa` link to a test (a static host needs no rewrite rules); the site's existing address still works.

## Importing the PAA questions

**Settings → Your questions → Add your question PDFs** in the PAA Portal accepts one or more PDFs with any file names, in the Educator Question Bank layout with English labels (Question ID, Assessment, Test, Domain, Skill, Difficulty, Question, Answer, Correct Answer, Rationale) and Spanish content. There is no active/inactive pairing. A question ID that appears in two files must agree with itself or that question is left out, and the first copy is used.

`src/importing/pdf/paa.ts` is the reading profile; `preparePaa.ts` orchestrates it. It differs from the SAT reader because the exports differ:

- **Pages scaled to fit.** Long readings are shrunk to one page, so the header table sits higher. The SAT reader's fixed coordinates miss it (53 of 154 pages in the supplied file). Columns are found from the header row instead.
- **Reading order.** The reading is printed between the question and its choices, but PDF text order puts it after the rationale. Question, choices and rationale are read by position. (Image crops were always positional.)
- **Shared readings.** Neighbouring questions of the same test that share at least 150 characters of text belong to one reading. The shared text becomes `passage` (margin line numbers removed) and the group a stable `passageGroup`. A quoted "Pregunta anterior" is not in every question, so it is never mistaken for the reading. Sessions keep a reading's questions together, in order. Where a PDF image already contains the reading it is not shown twice; the text is for search.
- **Choices.** Image or typeset choices have no useful text, so choices are the generic "Opción A–D" and the original layout is shown, as for the SAT. Image choices laid out two to a row put two labels on one line; labels are found in sequence.
- **Grid-ins** have no Answer section, only `Correct Answer:`; `15/2, 7.5` becomes two accepted forms.
- **Domains** are the guide's own categories, kept as printed (no English sentence-casing). **Skills** are grouped: the bank labels almost every question with a skill of its own (96 skills for 154 questions), which makes the skill filter and results useless, so `src/core/paaTaxonomy.ts` groups them under their domain (35 skills, none used once). The printed label is kept as `skillDetail` and shown beside the skill; it stays searchable. A label that is not listed stays as it is, so a new bank never loses a skill, and a bank saved before the grouping gets it on read. Redacción already has one skill per domain and is left alone.
- Rationale, Difficulty and Question ID in the supplied files were written for this study set, not by the College Board. The portal shows them as given and adds no note.

The supplied combined file (154 questions) converts completely: 49 Lectura, 18 Redacción, 45 Matemáticas, 42 Inglés; 144 multiple choice and 10 grid-ins; 16 shared readings covering 83 questions. The file does not mark which 56 are worked examples and which 98 are practice, so they form one pool. Splitting the file is not needed.

### Checking a file locally

```powershell
node scripts/pdf-paa-check.mjs "C:/path/to/PAA_banco.pdf"
```

Reads the PDF(s), prints counts, source IDs and page numbers (never question text), and reports Matemáticas first because it is the riskiest to read: typeset math, figures, image choices and grid-ins. It writes nothing and does not run in CI.

Riskiest pages in the supplied file, to look at by eye after any change to the reader: Matemáticas figure and image-choice pages, the grid-in pages, the seven "Pregunta anterior" pages, the readings with tables or figures, and the Redacción numbered-sentence boxes.

## Why there is no estimated PAA score

The SAT's estimate (200 + 600 × weighted accuracy) is a labelled heuristic, and a PAA one was considered and left out. What is sourced: the guide says the total of correct answers is "transformed into scaled scores", there is no penalty for wrong answers, and each part is scaled 200-800 (10-40 per subpart); the score is equated, so the same number correct can give different scores on different forms. No raw-to-scaled table for the current PAA was found: College Board does not publish one, the ETS research found is from 1973 and 1988 (an older generation, about linking to the SAT), and third-party converters start from a scaled score instead. The only way to produce a number would be to make up a curve, applied to a study bank that is not a real form (154 questions, self-selected, tests of any length). A made-up figure on a high-stakes scale does more harm than the percent correct the portal shows, so it does not. If College Board publishes a table, `src/core/timedTest.ts` summarizes per part and is where a conversion would go.

## Not covered

- Adaptive practice-test modules and score estimates for the PAA: the bank is by part, not full-length tests. Test mode is a timed run, not a simulation of a full form.
- Spanish for the long SAT help text; the PAA portal has its own Spanish help. A phrase without a Spanish entry falls back to English, and a test (`tests/i18n.test.ts`) fails if a phrase passed to `t()` has none.
- The Python preparation tool (`scripts/import_college_board.py`) reads SAT exports only; the PAA is prepared in the browser.
