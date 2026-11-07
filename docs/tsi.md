# TSI Portal

The portal serves three tests from one codebase: the **SAT**, the **PAA** and the **TSI** (the Texas Success Initiative Assessment 2.0, TSIA2). The header switch (**SAT · PAA · TSI**) moves between them from anywhere, and `#/tsi` links straight to the TSI. Everything below is what differs for the TSI. Content is always the person's own: the app and the website build contain **no College Board TSI questions** (only the original examples described in [examples.md](examples.md)), and no College Board item is ever committed.

## How the TSI differs

|                    | SAT Portal                                    | PAA Portal                              | TSI Portal                                                                                                                  |
| ------------------ | --------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Tests              | Reading & Writing, Math                       | Lectura, Redacción, Matemáticas, Inglés | ELAR (reading and writing together), Mathematics                                                                            |
| Language           | English                                       | Spanish                                 | English                                                                                                                     |
| Format             | Adaptive digital modules                      | Linear, timed parts                     | **Fixed-order practice, no clock, no modules** (the real test is adaptive and untimed)                                      |
| Scoring            | Estimated SAT range from full tests           | Percent correct only                    | **Percent correct and performance by domain and skill only.** No scaled score, no pass or fail                              |
| Calculator         | Bundled Offline (graphing) calculator on Math | None                                    | **One of three, per question** (below)                                                                                      |
| Reading sets       | One passage per question                      | Questions share a reading               | Questions share a reading (sets of 4 in the literary and essay items, paired passages in some informational items)          |
| Spoiler protection | Active practice-test questions hidden         | None                                    | None: everything imports as `unknown` and nothing is hidden. Unknown is not a promise that a question is safe from spoilers |
| Label              | none                                          | none                                    | **Official** (a College Board sample item) or **Original** (written for this portal)                                        |

## The questions, and what is Official or Original

Every TSI question is labelled in its own rationale: the last line is `Source: official College Board TSIA2 sample question…` or `Source: original practice item written…`. The importer reads that line and stores it as `origin` on the question.

- **Where it shows.** Not in a practice session (the question is central) and not as a filter. Browse and the question-details panel say Official or Original.
- **Include original questions** (Settings → Study preferences). Off hides every Original question from practice, Browse, Review and progress (their answers and bookmarks too) and leaves the Official ones. Nothing is deleted, and turning it on brings them back. It is only offered when the bank holds both kinds. A **session keeps working**: one that contains hidden questions stays, without those questions (it continues from the question it was on, or the next one still shown), and only a session with nothing else in it is left out. Implemented once, in the scoped view (`scopeStudyData(..., { hideOrigin })` in `src/core/assessments.ts`), so no screen has a rule of its own; the stored session is untouched.
- **Build.** A build made with `VITE_INCLUDE_OFFICIAL=false` refuses Official items at import (each is left out with the reason "College Board sample item left out: this build includes original items only"). One constant (`src/core/buildFlags.ts`), not a fork.
- A question with a missing or unrecognized Source line is **treated as Official** and listed under "Noted" in the import report.

The official items are College Board's copyright. Whether and when to distribute them is a decision for the owner of the portal. The app ships only the 60 + 60 original examples in `public/examples/` ([examples.md](examples.md)); delivering the full original bank would be a separate decision.

## Importing the TSI PDFs

The **Add your question PDFs** pop-up takes the TSI exports with any file names, alongside SAT and PAA exports in the same drop. A PDF that is not one of the four SAT file names is looked at (its first question page) and sorted by the **Assessment** value inside it: `PAA` or `TSIA2` (`TSI` also works); anything else is set aside and named. The tag beside each file says what it was taken for.

`src/importing/pdf/tsi.ts` is the reading profile; `preparePaa.ts` runs it through the same pipeline as the PAA (`prepareBankLibrary` with `TSI_PROFILE`), and the page layout is the PAA export's, so header columns, positional reading and reading sets are shared code (`paa.ts`).

- **The question is a picture of its page.** Each question and each explanation is cut from the page and stored as an image, so typeset math, the four figures (triangle, cylinder, bar chart, dot plot), the **underline in sentence-revision items**, numbered sentences and **two-column paired passages** appear exactly as printed. The extracted text is a secondary copy for search and the Browse list; it may lose math symbols and underlines, and that is accepted.
- **Reading order of the text copy.** The PDF reader already returns each column's lines together, so paired passages read left column then right. A reading that belongs to one question is told apart from its question by its smaller type (about 6.5 pt against 8.6 pt) and kept as `passage`; the question is the `stem`.
- **Reading sets.** Every question repeats the instruction printed above its passage ("Read the passage(s) below…", "Read the following early draft…"). That line is set aside before looking for shared text, or all sets would merge into one. Questions that share at least 150 characters of reading form one `passageGroup` (`tsi-g-<hash>`), which a session keeps together in order. In the supplied file: 6 sets of 4 questions.
- **Choices.** Shown inside the picture; the stored choices are the generic "Choice A–D" in the printed order. Choices are never reordered: the rationales refer to letters.
- **Calculator tag.** A Math stem ends with `[basic]`, `[square root]` or `[graphing]`. It becomes the question's `calculator` and is removed from the text. Because the picture would still print it, the tag's own box (known from the text layout) is painted white in the question image only (`maskPhrases` in `crops.ts`, `paintOver` in `raster.ts`), and a small chip shows the calculator instead.
- **Skills.** Used as printed (the supplied file has 13 ELAR and 23 Math skills for 170 questions, so no grouping like the PAA's is needed). Domains are the eight of the brief and are listed in `src/core/assessments.ts` for the performance overview.
- **Duplicates.** The same ID in two files must agree on metadata, label and answer key, or that question is left out and the first copy is used. Internal IDs are `tsi-<source ID>`, so they can never collide with SAT or PAA IDs.

The supplied files convert completely: 90 ELAR and 80 Math questions, 30 + 20 Official and 60 + 60 Original, no duplicate IDs, every answer equal to the PDF's `Correct Answer` line, calculator tiers 65 basic / 7 square root / 8 graphing.

### Checking a file locally

```bash
node scripts/pdf-tsi-check.mjs path/to/TSIA2_ELAR_banco.pdf path/to/TSIA2_Mathematics_banco.pdf
```

Prints counts, source IDs and page numbers (never question text), checks the answer keys and the calculator tags, and reports anything the reader could not convert. It writes nothing and does not run in CI.

Look at these by eye after any change to the reader: a literary set (4 questions on one passage), a paired passage, a sentence-revision item (underline), a figure item, and one item of each calculator tag.

## Calculators

What College Board says (TSIA2 [Administrator's Manual](https://accuplacer.collegeboard.org/accuplacer/pdf/tsia2-administrators-manual.pdf), "Use of Calculators"; [Mathematics sample questions](https://accuplacer.collegeboard.org/accuplacer/pdf/tsia2-mathematics-sample-questions.pdf); [Student brochure](https://accuplacer.collegeboard.org/accuplacer/pdf/tsia2-student-informational-brochure.pdf)): handheld calculators are not permitted online. Some, but not all, Math questions have a pop-up calculator; a calculator icon appears with the question, and the sample packet tags each item with the one it allows. There are three: **Basic** (4 function), **Square Root** (4 function with a square-root button) and **Graphing** (TI-84). The calculator can be moved around the screen and closed with the X; a question that offers several shows a drop-down menu, and only one is on screen at a time.

The portal follows that per question (`src/core/calculators.ts`):

| Tag             | Calculator                                                                           |
| --------------- | ------------------------------------------------------------------------------------ |
| `[basic]`       | Basic keypad (`src/core/simpleCalculator.ts`, `src/calculator/SimpleCalculator.tsx`) |
| `[square root]` | The same keypad with a √ key                                                         |
| `[graphing]`    | The bundled Offline calculator, as on the SAT                                        |
| none            | No calculator button                                                                 |

The keypads are one four-column grid (the operators stay in the right-hand column; the Square-root one adds √ beside the decimal point, and on the Basic one Equals takes the last two cells). They take typed keys (digits, `.`, `+ - * /`, Enter, Backspace, `C`, and `R` for √ on the Square-root one), show `Error` for division by zero or the root of a negative number, make no network request, and open in the same movable window as the graphing calculator (their own default size and saved position).

**How the √ key works.** The square root is taken of the number on the display, as soon as √ is pressed: type `9`, press √, and the display shows `3` (the result can then be used in the next operation, `16 √ + 4 =` gives 8). This is how an ordinary four-function calculator with a square-root key behaves, and is the best reading of "4 function with square root button". There is no separate "Ans" key: nothing College Board publishes mentions one, and a four-function calculator has only `=`.

**Not verified:** College Board's own tutorials (in the TSIA2 Student Portal) show the real keys, but they are not public, and none of the documents above says in which order √ is pressed, how operations are ordered or how numbers are formatted. The keypads carry out each operator as the next one is pressed, like a pocket calculator (`2 + 3 × 4` gives 20). The graphing one is the Offline engine, not a TI-84.

## The real test, as College Board describes it

Source: the TSIA2 [Student brochure](https://accuplacer.collegeboard.org/accuplacer/pdf/tsia2-student-informational-brochure.pdf) and [Technical Manual](https://accuplacer.collegeboard.org/accuplacer/pdf/tsia2-technical-manual.pdf), chapter 3.

- **Adaptive and untimed.** The multiple-choice tests are computer-adaptive (questions get easier or harder with your answers) and have no time limit. Each test has a fixed number of questions; pretest questions that do not count are mixed in unmarked. A "save and finish later" option allows a break (14 days; not for the essay).
- **Two stages per subject.** First the **College Readiness Classification (CRC)** test. A student who does not reach the college-ready benchmark then takes the **Diagnostic** test for that subject.
- **Mathematics CRC: 20 questions** = Quantitative Reasoning 6, Algebraic Reasoning 7, Geometric and Spatial Reasoning 3, Probabilistic and Statistical Reasoning 4.
- **Mathematics Diagnostic: 48 questions**, 12 from each of the four categories.
- **ELAR CRC: 30 questions**: 1 Literary Text Analysis set (4 questions on one passage), 11 discrete reading questions (2 Synthesis on paired argumentative passages and 9 Informational Text Analysis), 1 Essay Revision and Editing set (4 questions on one draft), and 11 discrete Sentence Revision, Editing, and Completion questions.
- **ELAR Diagnostic: 48 questions**, in one run with no break: 24 reading-focused (3 Literary sets of 4, 2 Synthesis, 10 other informational) then 24 writing-focused (3 Essay Revision and Editing sets of 4, 12 Sentence Revision questions).
- **Essay.** A separate test of one randomly chosen prompt, 300 to 600 words, scored on several qualities; it must be started and finished in one sitting.
- **Scores.** Reported on College Board's scales with college-readiness benchmarks and diagnostic levels. The portal shows none of this: the conversion depends on the adaptive model and is not published for practice answers.

## Practice tests (the Tests tab)

The Tests tab builds a practice test with the composition College Board publishes (see "The real test" above): **Mathematics or ELAR**, as the **College Readiness** test (20 or 30 questions) or the **Diagnostic** (48). Each is a session (`session.tsiTest`, `src/core/tsiTest.ts`) taken on the ordinary Practice screen with these differences: no answer is shown until the end, the test is untimed, **Exit** saves your place (the real test has "save and finish later"), and **you can go back to any question and change its answer** until you finish. (College Board's documents do not say whether the real test allows going back; a student who took it says it does, so the portal does. Answers are kept as drafts and scored when the test is finished.) The last question leads to the question map, which shows which questions are answered, and **Finish test** is there. At the end the results show percent correct and each domain, with the usual review of every question; there is no score and no pass or fail. Tests stay out of the ordinary session lists and out of "left unanswered" while they are in progress, and are listed under **Your tests** (open, rename, delete).

- **What a test is made of.** Mathematics: Quantitative 6, Algebraic 7, Geometric 3, Probabilistic 4 (Diagnostic: 12 each). ELAR CRC: 1 literary set of 4, 2 paired-passage (Synthesis) questions, 9 other informational, 1 essay-revision set of 4, 11 sentence questions; ELAR Diagnostic: 3 literary sets, 2 Synthesis, 10 informational, 3 essay sets, 12 sentence questions. Reading-focused questions come first, each half starting with its sets, as the Diagnostic does. Sets stay together in the bank's order.
- **How questions are chosen.** From the questions the Settings currently show (so **Include original questions** applies), preferring those answered least, then at random. Nothing is routed by difficulty: the real test is adaptive, but a bank of this size cannot be, so the portal keeps the real content balance instead.
- **A bank that is too small** builds what it can. The setup shows, for each part, what the real test uses and what the bank holds, and how many questions the test will have; a finished test says if it was shorter. (The supplied bank fills all four tests, but only has 3 literary and 3 essay sets, so ELAR tests repeat sets after a few.)
- **Domains must match.** A question counts toward a part by its **Domain** (exactly as in the list above) and, for the paired passages, by its **Skill** being `Synthesis`; passage sets are questions that share one `passageGroup`.
- If Original questions are switched off while a test is in progress, the test continues without them (like any session) and returns whole when they are switched back on.

## Adding more questions to the PDFs

Both the TSI and the PAA import any number of PDFs with any file names, so a longer file, or another file, can simply be added in **Add your question PDFs**: new IDs are added, an ID already stored with the same content is skipped, an ID whose content changed is refreshed (your answers stay), and an ID that appears in two files must agree in both or that question is left out. (The SAT is different: it needs its four named files, read as active and inactive sets; new SAT questions would have to go inside those files.) Each TSI page needs:

- A unique **Question ID** of 8 hex characters.
- The header table: `Assessment` = `TSIA2`, `Test` = `ELAR` or `Mathematics`, `Domain` (one of the eight names above, spelled exactly), `Skill` (free text), `Difficulty` = Easy, Medium or Hard.
- `Question` with the stem, `Answer` with choices `A.` to `D.`, `Correct Answer: X`, and `Rationale`.
- A last rationale line `Source: official College Board TSIA2 sample question…` or `Source: original practice item…` (anything else counts as Official).
- Math: the stem ends with `[basic]`, `[square root]` or `[graphing]`.
- ELAR sets: the four questions of a set on consecutive pages, each repeating the same passage (in smaller type than the question); a paired passage has its two columns headed `Passage 1` and `Passage 2`, with Skill `Synthesis`.

`node scripts/pdf-tsi-check.mjs <pdf>` checks a file locally before it is added: counts, IDs, answer keys, tags and reading sets.

## Data: one record, three tests

`Question`, `Attempt` and `Session` carry `assessment` (`"SAT"`, `"PAA"` or `"TSI"`); data stored before the PAA or TSI existed has no field and is read as SAT. Everything described in [the PAA notes](paa.md) about separate progress, separate maintenance and per-test preferences applies to the TSI too: reset progress, its recovery archive (`reset-archive-TSI`) and **Remove my questions** act on the TSI only, and **Erase all data on this device** covers all three. The Include-original-questions switch is a browser preference (`sat-tsi-original`, so Erase removes it).

## Not covered

- Adaptive testing, timed modules, a clock, and any score or pass/fail for the TSI: the real test is adaptive and untimed, and no official conversion exists.
- A "choose your test" screen on first visit: the header switch and `#/tsi` are the ways in for now.
- Shipping the original items inside the app (see above).
- Routing a test by difficulty, and the essay test.
- The Python preparation tool (`scripts/import_college_board.py`) reads SAT exports only; the TSI is prepared in the browser.
