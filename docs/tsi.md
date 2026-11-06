# TSI Portal

The portal serves three tests from one codebase: the **SAT**, the **PAA** and the **TSI** (the Texas Success Initiative Assessment 2.0, TSIA2). The header switch (**SAT · PAA · TSI**) moves between them from anywhere, and `#/tsi` links straight to the TSI. Everything below is what differs for the TSI. Content is always the person's own: the app and the website build contain **no TSI questions**, and no College Board item is ever committed.

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

Every TSI question is labelled in its own rationale: the last line is `Source: official College Board TSIA2 sample question…` or `Source: original practice item written…`. The importer reads that line:

- The label shows as a small badge (Practice, Browse) and as its own **Source** filter (Official, Original, or both). The filter appears under **Refine selection** and only when both kinds are stored.
- A question with a missing or unrecognized Source line is **treated as Official** and listed under "Noted" in the import report. The safe side for a version that must carry no College Board items.
- **Hide:** Settings → **Include College Board sample items**. Off hides every Official item from practice, Browse, Review and progress (their answers, bookmarks and the sessions that contain them too). Nothing is deleted, and turning it on brings them back. Implemented once, in the scoped view (`scopeStudyData(..., { hideOfficial })` in `src/core/assessments.ts`), so no screen has a rule of its own.
- **Remove:** Settings → Your questions → **Remove official items** (after one confirmation). Original items, answers and bookmarks stay; sessions that used a removed item end. Adding the PDFs again brings the Official items back (`removeOfficialFromData` in `src/core/pdfLibrary.ts`).
- **Build:** a build made with `VITE_INCLUDE_OFFICIAL=false` refuses Official items at import (each is left out with the reason "College Board sample item left out: this build includes original items only") and does not offer the Settings switch or the removal button (`src/core/buildFlags.ts`). One constant, not a fork.

The official items are College Board's copyright. Whether and when to distribute them is a decision for the owner of the portal; these three tools are what makes an originals-only version possible. The app still ships with no questions at all, so a paid build would also need a way to deliver the original items; that is not part of this change and would need the question-material rule in `AGENTS.md` to be revisited.

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

The real TSIA2 offers no personal calculators; it provides one on-screen calculator on the Math questions that allow one, and College Board's sample packet tags each item with it: **Basic** (add, subtract, multiply, divide), **Square root** (Basic plus a square-root key) or **Graphing** (described as doing what a TI-84 does). Sources: [Rockwall ISD, TSIA2 platform features](https://www.rockwallisd.com/Page/13064); [Klein ISD, TSIA2 mathematics](https://sites.google.com/kleinisd.net/tsia-2/math); [College Board TSIA2 mathematics sample questions](https://www.lisd.net/cms/lib/TX01918037/Centricity/Domain/4324/tsia2-mathematics-sample-questions.pdf).

The portal follows that per question (`src/core/calculators.ts`):

| Tag             | Calculator                                                                           |
| --------------- | ------------------------------------------------------------------------------------ |
| `[basic]`       | Basic keypad (`src/core/simpleCalculator.ts`, `src/calculator/SimpleCalculator.tsx`) |
| `[square root]` | The same keypad with a √ key                                                         |
| `[graphing]`    | The bundled Offline calculator, as on the SAT                                        |
| none            | No calculator button                                                                 |

The keypads work like a pocket calculator: each operator is carried out when the next is pressed, so `2 + 3 × 4` gives 20. They take typed keys (digits, `.`, `+ - * /`, Enter, Backspace, `C`, and `R` for √ on the Square-root one), show `Error` for division by zero or the root of a negative number, make no network request, and open in the same movable window as the graphing calculator (their own default size and saved position).

**Not verified:** College Board does not publish how its Basic and Square-root calculators order operations or format numbers, and the graphing one is the Offline engine, not a TI-84. These are modelled on the features described, not copied from the real software.

## Data: one record, three tests

`Question`, `Attempt` and `Session` carry `assessment` (`"SAT"`, `"PAA"` or `"TSI"`); data stored before the PAA or TSI existed has no field and is read as SAT. Everything described in [the PAA notes](paa.md) about separate progress, separate maintenance and per-test preferences applies to the TSI too: reset progress, its recovery archive (`reset-archive-TSI`) and **Remove my questions** act on the TSI only, and **Erase all data on this device** covers all three. The Include-sample-items switch is a browser preference (`sat-tsi-official`, so Erase removes it).

## Not covered

- Adaptive testing, timed modules, a clock, and any score or pass/fail for the TSI: the real test is adaptive and untimed, and no official conversion exists.
- A "choose your test" screen on first visit: the header switch and `#/tsi` are the ways in for now.
- Shipping the original items inside the app (see above).
- The Python preparation tool (`scripts/import_college_board.py`) reads SAT exports only; the TSI is prepared in the browser.
