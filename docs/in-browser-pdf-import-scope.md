> **History.** This describes the original four-file SAT import. That path was removed: the app now takes one PDF per test, sorted by the Assessment column, checks an access code on each PDF and reads the SAT's ACTIVE / INACTIVE badge. See [pdf-import.md](pdf-import.md). The notes on layout, parity and limits below still apply to the reader.

# Scope: preparing a question library from PDFs inside the browser

Status: proposal and feasibility spike, 2026-11-02. Nothing in this document is implemented.

## Goal

Let a person choose their own PDF exports on the hosted site and get exactly the library that `scripts/import_question_bank.py` produces today, with no Python, no install, and no upload. Everything stays in the browser, works offline, and ends in the same IndexedDB records the folder import already writes.

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
- **Pure core in TypeScript, tested in Vitest.** The regular expressions and crop rules are ported one-to-one from `import_question_bank.py` and `scripts/test_pdf_import.py`, with the same synthetic cases plus a highlight-leak case.
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
- **Format specificity.** The importer expects this export layout and four named files. A different layout will quarantine questions rather than import wrongly.
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

## Phase 2 results (2026-11-02)

Phase 2 is implemented: `crops.ts` (where to cut each question's pages), `raster.ts` (trim and rounding), `panels.ts` (render, trim, encode, hash, store; the renderer and store are injected), and `pdfjsAdapter.ts` (the only file that touches pdf.js). Unit tests are in `tests/pdfPanels.test.ts`.

### Image parity with the Python library, all 3,770 questions

Run locally with `node scripts/pdf-render-check.mjs --pdfs <folder> --private <private-data> --step 1 --limit 4000`. It serves the PDFs and the Python library on 127.0.0.1 for the run, renders in headless Edge through the production code path, and compares each image with the Python image. It writes nothing and never runs in CI.

| Check | Result |
| --- | --- |
| Questions processed with no error | 3,770 of 3,770 |
| Questions where the number of question and explanation images differs from Python | 0 |
| Images compared | 7,777 |
| Image width | 1160 px, identical |
| Height identical | 2,680 (34%) |
| Height within 2 px | 7,608 (98%) |
| Height differs by 3 px or more | 169 |
| Mean absolute pixel difference | 2.0 of 255 |
| Time to render, trim, encode and hash | 33.6 ms per image; 709 s for the whole run including comparison |

The 169 larger differences are of two kinds. Thirty-five are blank strips (a continuation page's top margin) where both images are white and only Python's strip is taller, because Python's answer-key box on that page is the odd one noted in phase 1. About 130 are question images that are 3 to 6 px shorter than Python's: a sliver of faint edge pixels that MuPDF draws and pdf.js does not. One question has about 16 pt of extra white space above its graph in the Python image. I checked it, and a chart-and-choices question side by side, by eye: the content is identical and only sub-pixel edge differences remain. No missing glyphs or figures were found.

Pixels are not byte-identical to the Python tool's, because the two renderers anti-alias differently, so image hashes differ. A library prepared in the browser is therefore a new revision, not a repeat of the Python one; it replaces matching questions by source ID and keeps answers, notes, and bookmarks. Running both would store the images twice.

### Synthetic export checks

`scripts/make_synthetic_export.py` writes an original PDF in the export's layout, and `node scripts/pdf-render-check.mjs --synthetic <file>` runs the whole pipeline on it in the browser. Ten checks pass: both questions found, choice and numeric answers read from their keys, a yellow highlight annotation over the correct option is not drawn (a control run with annotations on fails this check, so it does detect the highlight), math starting right under the heading is not clipped, the answer-key area stays out of the question image, every image is full width, a question that continues onto a second page gets two question images, images are WebP, and WebP encoding is lossless (decoded pixels equal rendered pixels).

### Findings worth keeping

- An opaque canvas turns on LCD text smoothing, which tints glyph edges with colour and made harmless text look like a highlight. The renderer therefore uses a canvas with alpha and paints the page white.
- pdf.js 6 has no `isEvalSupported` option and needs no `unsafe-eval`, so the page's content-security policy is unchanged.
- The real exports embed their glyphs, so no font data files are needed for them. A PDF that does not embed its fonts needs pdf.js's standard font files; the synthetic export embeds its font for that reason.

### Next

Phase 3 (UI and delivery): the Settings flow, progress and cancel, a report, a browser test on the synthetic export in CI, licenses and offline caching of the PDF engine.

## Phase 3 results (2026-11-02)

Phase 3 is implemented. The Settings page has a "Prepare from your PDF exports" card (`src/ui/PdfPrepare.tsx`): choose the four exports, say what the active files contain (no default, so nothing is marked active without the person saying so), start, watch progress, cancel, and read a report with a downloadable copy. `src/importing/pdf/prepare.ts` runs the preparation with the reader, encoder, and storage injected; `run.ts` connects it to pdf.js and IndexedDB and then imports through the same `ingestLibrary` as a prepared folder, so the library is validated byte for byte (manifest revision, count, image references, every image hash) before it is used.

### Full preparation on the real exports, through the production code

`node scripts/pdf-render-check.mjs --pdfs <folder> --private <private-data> --prepare --mode active-only`, in headless Edge, images discarded after hashing.

| Check | Result |
| --- | --- |
| Questions prepared | 3,770 of 3,770, in the Python library's order |
| Quarantined | 0 |
| Distinct images | 7,731, the same count as the Python library |
| Answers, answer origin, choices, status, provenance, reviewed-exception warning | 0 mismatches |
| Question and explanation image counts, and image width (1160 px) | 0 mismatches |
| Stem / rationale text | 6 and 7 of 3,770 differ (search text only, as in phase 1) |
| Time | 291 s for the whole preparation |

### Delivery

- **Lazy loading.** The PDF reader and the preparation code load only when someone starts a preparation (a 452 KB chunk plus the 1.27 MB pdf.js worker). Studying never loads them, and the page's content-security policy is unchanged.
- **Offline.** The service worker does not precache the reader, so the first visit stays small. It caches the reader the first time it is used (a runtime cache named after the build version, replaced with each build), and a browser test prepares the synthetic exports, goes offline, reloads, and prepares again.
- **Licence.** pdf.js is now a runtime dependency; its Apache-2.0 notice is in `public/licenses` and listed in the index. The notices script skips optional native add-ons that are not part of the browser build.
- **Tests.** `tests/pdfPrepare.test.ts` covers file matching, reviewed exceptions, statuses, provenance, merged and conflicting source IDs, quarantine, cancel, and that the importer accepts the result. `tests/browser/pdf-prepare.spec.ts` runs the whole flow in the browser on four small original PDFs (`tests/fixtures/synthetic-exports.json`, regenerated with `scripts/make_synthetic_export.py`): preparation, hidden active questions, a 1160 px image, no highlight pixels, persistence across reload, and that all four files are required.

## Update: a simpler Settings page (2026-11-02)

Settings now has one section, **Your questions**, with the PDF card (renamed **Add your question PDFs**) and Reset study progress with undo. Three things changed from the phase 3 design:

- **No question about active files.** Each subject's two files are read from their contents (`classify.ts`, `inferMode`): no question in common means an inactive set and an active set; an active file that contains every inactive question is an inclusive set; an uneven overlap marks the questions that cannot be proven as unknown. A short note under the result says which reading applied, and the Python-style modes remain available to code and tests. The real exports are disjoint, so they read as active-only, as the Python run used.
- **Export, restore and folder import removed.** Browser data is a study aid, so the backup/restore pair and the prepared-folder importer were taken out; the PDF card is the one way to add questions on the hosted site. The snapshot validators stay because Reset's undo uses them. The Python tool and the local server still produce and load a prepared folder for local use.
- **Unused images are removed automatically** after a preparation, so replacing questions never leaves a second copy behind.

The reviewed-exceptions file moved under an **Advanced** disclosure, and Help gained a short note on adding questions.

## Update: no bundled sample, blank panels dropped, clearing data

- **No bundled sample questions.** The twelve original examples are now a test fixture (`tests/fixtures/synthetic.json`) only. The empty Home and Browse screens point to Settings → Your questions. Adding PDFs also removes leftover example questions unless the person already has answers or bookmarks on them.
- **Blank panels are dropped.** About 1% of explanation panels are an entirely empty second page; they were kept at full page height. They are now left out (one panel per kind is always kept). This deliberately differs from the Python tool, so `scripts/pdf-render-check.mjs` counts fewer panels as `droppedBlankPanels` instead of a mismatch.
- **Free up space.** Settings has "Remove my questions" (keeps answers and bookmarks, ends saved sessions) and "Erase all data on this device" (database, `sat-` settings, offline copy, service worker), with the current storage use from `navigator.storage.estimate()`.

## Decision: questions stay images

A spike checked whether the PDF text layer explains everything drawn in each question image (all 3,770 questions, 7,775 images). Reading & Writing: 1,710 of 1,844 questions (92.7%) were fully text; the rest have tables, charts or no text. Math: 21 of 1,925, because every number, variable and fraction is drawn as shapes, not text. Real text for math would need OCR or a vision model, which cannot run offline or be trusted blindly. The owner chose to keep every question as an image, so the spike script was not kept.

## Update: one pop-up, a PDF manager, and why the PDFs are not merged (2026-11-04)

- **A pop-up replaces the trip to Settings.** "Add your question PDFs" on the empty Home, Browse and Tests screens opens a dialog (`AddPdfsDialog.tsx`, a native `<dialog>`) with a drop area and a file picker. All PDFs go in together: the four SAT exports are recognised by name and read as a set, every other PDF is read as a PAA export or set aside, and non-PDF files are ignored and listed. A folder of extracted exports can be dropped on the dialog (it is walked, subfolders included, with `webkitGetAsEntry`; `src/ui/droppedFiles.ts`), and its PDFs are sorted exactly like loose files. Zip files are deliberately not read: that would need a new bundled library and hold all the files in memory at once, so extract the zip first. Everything is read locally, with no network request. The two importers run one after the other and report separately. The SAT all-four rule is unchanged: with some SAT files missing, the dialog says which and still imports the PAA part. A SAT export saved under another name is not recognised and is set aside by the PAA reader after it has been read, so the dialog tells people the names it expects.
- **Settings is a manager** (`PdfManager.tsx`). It lists the PDFs behind the stored questions, read from each question's `document.provenance` (`src/core/pdfLibrary.ts`, `summarizePdfs`), with test, parts, question count and active/inactive counts. **Add PDFs** opens the same pop-up. **Remove** takes one PDF out (`removePdfFromData` / `removePdfQuestions`): a question that another stored PDF also provides stays, answers and bookmarks are kept, and sessions that used a removed question end. Removing one SAT file leaves the SAT set partial, so putting it back means adding all four again.
- **Merging the five PDFs into one was evaluated and not done.** Active versus inactive exists only as which of four named files a question came from; the pages carry no status. A merged file erases it, and unknown questions are shown by default, which would put unused practice-test questions in front of the reader. The SAT card refuses a file with no recognised name, the PAA card would quarantine every SAT question, one file would be about six times the size of the largest export read today (memory unmeasured, nothing saved until the end), every question would carry the same provenance, and updating one source would mean rebuilding the whole bundle. Dropping the five files together gives the same convenience without any of this.
