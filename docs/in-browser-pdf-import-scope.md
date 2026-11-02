# Scope: preparing a question library from PDFs inside the browser

Status: proposal and feasibility spike, 2026-11-02. Nothing in this document is implemented.

## Goal

Let a person choose their own PDF exports on the hosted site and get exactly the library that `scripts/import_college_board.py` produces today, with no Python, no install, and no upload. Everything stays in the browser, works offline, and ends in the same IndexedDB records the folder import already writes.

Non-goals: arbitrary PDF layouts, OCR, fetching anything from the network, and changing how questions are stored, scored, or hidden.

## What the spike showed

Run on `read_write_inactive.pdf` (805 pages, 43 MB) with pdf.js 6.5 (Apache-2.0) in Edge, locally, with nothing leaving the machine.

| Question | Finding |
| --- | --- |
| Can it open the files? | Yes. The 805-page file opened in about 0.2 s. Total source size is about 263 MB across four files, so reading one file at a time into memory is fine. |
| Is it fast enough? | Rendering a full page at 2x took 15 to 45 ms, and WebP encoding about 70 ms. At roughly 7,700 crops the conversion is on the order of ten minutes single-threaded, less with workers. Crops are smaller than the full pages measured. |
| Can it produce WebP? | Yes in Chromium (`OffscreenCanvas.convertToBlob`). The files are RIFF/WebP "VP8X". **Still to confirm:** that quality 1 gives lossless output as Python's `lossless=True` does. Safari does not encode WebP. |
| Does text geometry match PyMuPDF? | Yes, up to one constant. For the heading and the "Rationale" label, pdf.js boxes are exactly 1.14 pt above PyMuPDF's on every sampled page (same height). This must hold across the corpus, because the crop starts 0.2 pt below the heading and an earlier test shows a few points of error clips equations. |
| Is the text extraction directly usable? | No, it needs a layer. pdf.js returns fragments such as `T` + `est` and splits "Correct Answer:" across items, where PyMuPDF returns words and phrase hits. The importer's regular expressions depend on line breaks and spacing, so a word and line builder is required. |
| Annotations? | The pages carry annotations (two each in the samples). pdf.js can skip them (`AnnotationMode.DISABLE`), but the answer-highlight leak test must be rerun against the new renderer. |

Conclusion: feasible, with the main risk being fidelity (text spacing and crop boundaries), not speed or capability. That risk is testable, which is why the plan below is built around a parity check.

## Design

Follows AGENTS.md: core rules separate from presentation, no imported material in the repo, imports validated as untrusted.

```
src/importing/pdf/
  layout.ts        pure: text fragments -> words and lines; phrase search -> boxes
  segment.ts       pure: pages -> source questions, metadata columns (index_export)
  answers.ts       pure: answer-key extraction and explicit-rationale fallback
  classify.ts      pure: active / inactive comparison across the four exports
  crops.ts         pure: crop rectangles from boxes (question, explanation)
  pdfjsAdapter.ts  the only file that touches pdf.js: words, render, trim, encode, hash
  prepare.ts       orchestration, progress, cancel, report
```

- **Reuse the existing import path.** As assets are produced they are written to the `assets` store (hash-named, idempotent). Then `prepare.ts` hands an in-memory manifest and `questions.json` to the existing `ingestLibrary`, which already validates the revision hash, count, references, and every image hash. No new storage or merge code, and a rerun resumes cheaply because existing assets are skipped.
- **Pure core in TypeScript, tested in Vitest.** The regular expressions and crop rules are ported one-to-one from `import_college_board.py` and `scripts/test_pdf_import.py`, with the same synthetic cases plus a highlight-leak case.
- **pdf.js is lazy-loaded** and never loaded for ordinary studying. `isEvalSupported: false` keeps the current CSP, so no `unsafe-eval` is added.
- **UI:** Settings, Library & maintenance, "Prepare from PDF exports". Choose the four files, state whether the active files are active-only or inclusive (the existing `--active-mode` choices, with the same explanations), then run with phase progress, cancel, and a final report: imported, quarantined with reasons, and counts. Nothing is guessed: unrecognized metadata, ambiguous answers, or unsafe crop boundaries quarantine the question, as today.

## Gate: parity with the Python output

The Python-prepared library for your four PDFs already exists (3,770 questions). A local-only harness (never in CI, never committed) runs the browser preparer on the same PDFs and compares:

1. Identical set of source IDs and identical section, domain, skill, difficulty, and test status.
2. Identical answers (choice letter, or the same accepted numeric entries). **Required: 100%.**
3. Same number of question and explanation panels per question; panel pixel sizes within 2 px.
4. Stem and rationale text equal after whitespace normalization; any differences listed for review, not silently accepted.
5. A visual sample (a few hundred random questions plus all edge cases) reviewed side by side.

CI uses a tiny synthetic PDF fixture (original content, generated by PyMuPDF and committed) for unit and browser tests, including the annotation-leak and tight-numerator cases.

## Phases

1. **Text layer and logic (core):** `layout`, `segment`, `answers`, `classify` with unit tests, plus the text-level parity check on all 3,770 questions. No rendering yet. This is where most of the risk is retired.
2. **Crops and rendering:** boundary rules, trim, encode, hash, asset writing; image-level parity; annotation-leak test; confirm lossless WebP and the 1.14 pt offset over the whole corpus.
3. **UI and delivery:** the settings flow, progress and cancel, report, synthetic-PDF browser test, docs, licenses (pdf.js notice via the existing `update-notices` script), and the offline-cache decision below.
4. **Hardening:** worker concurrency if the measured time is too long, memory checks with all four files, Firefox and Safari behavior, clearer errors for files in a different layout.

Relative effort: phase 1 is the largest, phase 2 is medium, and phases 3 and 4 are smaller. In total this is a multi-session project rather than a quick addition.

## Risks

- **Text spacing differences** change what the answer regular expressions see. Mitigated by the 100% answer parity requirement.
- **Crop boundaries** are sensitive to fractions of a point. Mitigated by the calibrated offset, a pixel-level trim, and image parity checks.
- **Format specificity.** The importer expects this College Board export layout and four named files. A different layout will quarantine questions rather than import wrongly.
- **Browser support.** WebP encoding is available in Chromium-based browsers. Elsewhere a PNG fallback would need the manifest check loosened from `.webp` to allow `.png`.
- **Bundle size.** pdf.js adds about 1.8 MB (main and worker) plus font and CMap data. Lazy loading keeps it out of normal use.
- **Memory.** One PDF at a time (up to 80 MB), with images streamed into IndexedDB rather than held in memory.

## Decisions needed

1. **Layout scope:** support only this export layout (recommended), or attempt generic PDFs later as a separate project.
2. **Manual override:** your corpus has one reviewed question whose options are printed in an unusual way, handled today by a private override file. Options: allow an optional overrides file in the UI, or let that question quarantine with an explanation. Recommended: the optional file.
3. **Image format:** WebP only (recommended, matching today) with a documented browser requirement, or also allow PNG fallback.
4. **Offline caching of the PDF engine:** precache it for guaranteed offline preparation (adds a few MB to the first visit), or cache it the first time it is used (recommended).
5. **Where the parity harness lives:** a local script in `scripts/` that reads `private-data/`, never run in CI (recommended).

## Phase 1 results (2026-11-02)

Phase 1 is implemented: `src/importing/pdf/` holds the text layer and logic (`layout`, `segment`, `answers`, `classify`, `record`), covered by `tests/pdfText.test.ts`. It runs without a browser; the PDF reader only supplies text fragments, so it is unit tested with synthetic fragments. `pdfjs-dist` is a dev dependency for now (the parity tools use it); it becomes a runtime dependency in phase 3.

### Parity with the Python tool, on the four real exports

Run locally with `node scripts/pdf-parity.mjs --pdfs <folder> --private <private-data> --golden <label geometry>`. It reads private files, writes nothing, and never runs in CI.

| Check | Result |
| --- | --- |
| Questions found, and the pages assigned to each | 3,770 of 3,770, identical |
| Section, domain, skill, difficulty | 0 mismatches |
| Answers (choice letter or accepted numeric entries), answer origin, choices | 0 mismatches (required 100%) |
| Active, inactive status | 0 mismatches |
| Reviewed override and its warning | identical |
| Questions quarantined | 0 |
| Stem text | 6 of 3,770 differ |
| Rationale text | 7 of 3,770 differ |
| Page text after whitespace normalization | 3,993 of 4,007 pages identical |
| Label boxes (question heading, answer key, rationale) | within 0.7 pt |

### What it took

- **Word spacing.** MuPDF inserts a word space whenever a run starts 8% or more of the font size away from the end of the previous run, in either direction. That explains spaces after punctuation before a closing quote and in kerned pairs such as "T." The cutoff is sharp (0.0815 already changes results), and it uses the larger of the two font sizes. Scaled fonts report a size of 1.2 or 1.35 whose real size is about 12.
- **Label boxes.** A glyph box is the font size split 0.8555 above the baseline and 0.1445 below. It reproduces PyMuPDF's heading, answer-key, and rationale boxes. A few pages (about 4%) sit 0.65 to 0.69 pt off; crops are pixel-trimmed afterwards, so this should not show, and phase 2 checks it.
- **Python quirks that do not matter.** On continuation pages PyMuPDF's case-insensitive search matches prose that begins with "questions" as a heading, and on one page it reports odd answer-key boxes. Neither is used by the crop logic.

### What cannot be matched exactly

Fourteen pages differ in search text only: pdf.js sometimes puts a space inside one text run where MuPDF does not (for example "they’ ll"), and one page has a variation selector after a symbol. No answer, metadata, or classification is affected. The fix would be reading glyph positions from the operator list, which is not worth it for approximate search text. The question and explanation images, not the text, are what a person reads.

### Local tools

- `scripts/pdf-parity.mjs`: the full comparison above.
- `scripts/pdf-parity-diff.mjs`: shows where page text differs; `--classify` summarizes the kinds of difference.
- `scripts/pdf-items.mjs`: prints the text items on one page, for investigating a difference.

### Next

Phase 2 (crops and rendering): crop rectangles from these boxes, rendering with annotations hidden, pixel trim, lossless WebP, hashing, asset writing, and image-level parity.
