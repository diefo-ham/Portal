# Example questions

The portal is the same for everyone. The questions are what differ: a fresh install already holds **120 original example questions for each test** (SAT, PAA and TSI, 360 in all), written for this portal. They are not College Board items and are not the person's own material. The person's own PDFs (the ones they obtain and add themselves) are what unlock the Tests screens and bring the real banks.

## What the examples are

- Written by Claude, in the Educator Question Bank layout the importers already read (header table, Question, Answer, Correct Answer, Rationale). Each page's last line says so (`Source: original practice item written by Claude…`).
- Normal questions everywhere else: Browse, Practice, Review, filters, bookmarks, progress and reset all treat them like any other question of their test. Difficulty is an estimate.
- **SAT:** no active/inactive information (`testStatus: "unknown"`), on purpose. Practice Tests build their modules from `active` questions, so the examples can never make one. **PAA and TSI:** `unknown`, as every PAA/TSI import is. The TSI ones are labelled **Original**, so the Settings switch "Include original questions" hides them like any other Original item.
- The question is a picture of its page (figures, typeset math, tables, line-numbered poems), with the text kept as a searchable copy, exactly as for an import.

## What the Tests screens do

Practice Tests (SAT), Test mode (PAA) and Tests (TSI) stay **visible but locked** for a test until the person has added at least one question of their own for it (`hasImportedQuestions` in `src/core/assessments.ts`; the screen is `src/ui/TestsLocked.tsx`). It explains why and offers **Add your question PDFs**. After that the screens behave exactly as before, and a test is built only from the person's own questions: the Tests screens receive a view without the examples (`scopeStudyData(..., { hideBundled: true })`), so an example never ends up in a test, a result or a "Your tests" list.

## How they are stored

- Every example has `bundled: true` (optional on `Question`; absent on everything else, so no migration) and `source` "Portal example questions". Internal IDs are `example-<id>`, `paa-example-<id>` and `tsi-example-<id>`, so they cannot collide with an import.
- They ship as a prepared library in `public/examples/` (`manifest.json`, `questions.json`, `assets/<sha256>.webp`), the same format the local server's library uses, and are read by the same `ingestLibrary` (`src/importing/preparedLibrary.ts`: integrity checks, one receipt per revision, refresh in place by `(assessment, source, sourceId)`). The receipt is `examples:<revision>`, so opening the app again copies nothing. `loadBundledExamples` never stops the app from opening: if the files cannot be read it carries on and tries again next time.
- Offline: after the first load the questions and their images are in the local database and need no network. The service worker caches the manifest and questions but not the 720 images (about 20 MB), which are copied into the database once, so a release does not download them again.
- **Remove my questions** removes only the person's questions; the examples, their images and the sessions made only of them stay, and the person's import receipts go so the same PDFs can be added again. **Erase all data on this device** removes everything, examples included; they return on the next load. Progress reset keeps questions, so it does not touch them. The PDF list in Settings never shows them (no file provenance).
- The examples are listed under **Your questions** as "Only the example questions are here so far" until the person adds their own, and Home says so.

## Regenerating them

The source PDFs are not in the repository (`*.pdf` is ignored and the deploy check rejects them). Give the generator the PDFs:

```bash
node scripts/build-examples.mjs \
  --sat SAT_Original_Part1.pdf SAT_Original_Part2.pdf \
  --paa PAA_Original_Part1.pdf PAA_Original_Part2.pdf \
  --tsi TSI_Original_Part1.pdf TSI_Original_Part2.pdf
```

It reads them with the production PDF reader in a headless browser on 127.0.0.1 (set `CHROMIUM_PATH` if Playwright's own browser is not installed), marks every question as bundled, and rewrites `public/examples/`. The same PDFs always give the same revision. The SAT examples use their own reading profile (`SAT_EXAMPLES_PROFILE`, `src/importing/pdf/satExamples.ts`) because the SAT importer reads four named active/inactive files, not one bank-layout file; the Add-PDFs dialog does not use it.

The current set: SAT 66 Reading and Writing + 54 Math (13 student-produced response); PAA 38 Lectura, 16 Redacción, 34 Matemáticas, 32 Inglés (18 shared readings covering 77 questions); TSI 60 ELAR + 60 Mathematics (4 sets of 4, calculator tags 52 basic / 3 square root / 5 graphing).

## Not covered yet

How imports interact with the examples beyond the above (for example, what to do when an imported question duplicates an example) and any new import rules are the next step.
