# Local PDF question bank

The four user-provided exports contain **3,770 unique source question IDs** across 4,007 pages. Section, domain, skill, and difficulty come from the PDFs' metadata tables. The user confirmed that the active files contain **only active questions**. No source IDs overlap between the active and inactive sets.

| Section           | Inactive | Active | Total |
| ----------------- | -------: | -----: | ----: |
| Reading & Writing |      753 |  1,092 | 1,845 |
| Math              |      995 |    930 | 1,925 |
| Total             |    1,748 |  2,022 | 3,770 |

Difficulty totals: 1,296 easy, 1,254 medium, 1,220 hard. Active questions remain hidden by default. Existing synthetic questions, if previously loaded, remain separate from these totals.

## Use the imported bank

Start the application as usual and refresh the page. The local server exposes the prepared library to the application. On the first visit in each browser profile, a progress message appears while question images are verified and saved into IndexedDB. Subsequent launches reuse the stored content. Questions, images, notes, bookmarks, and answers then work without internet access.

All imported material stays under ignored `private-data/` and in the browser database. It is excluded from Git and the Vite production bundle. Keep `private-data/library/` with this local installation so another browser profile can load it. The same questions can also be prepared directly in the browser from the PDFs. Source PDFs remain in Downloads and are read-only.

## Prepare directly in the browser

The portal's question PDFs are three files, one per test (SAT, PAA, TSI), in the Educator Question Bank layout: one question per page, a header table (Assessment, Test, Domain, Skill, Difficulty), then Question, Answer, Correct Answer and Rationale.

**Add your question PDFs** (on the empty Home, Browse and Tests screens, and **Add PDFs** in Settings → Your questions) opens a pop-up. Drop the PDFs (or the folder that holds them) into it, together or one at a time, or use **Choose the PDFs** (non-PDF files are ignored and listed). **File names do not matter**: each PDF is looked at (one at a time) and sorted by the **Assessment** value inside it, `SAT`, `PAA` or `TSIA2`; anything else is set aside and named. The pop-up does not name the test beside each file. Press **Add questions**.

- **Access code, one per PDF.** Each PDF carries the code for its test, `Ref. SAT-…`, `Ref. PAA-…` or `Ref. TSI-…`, in small gray text at the bottom left of its pages. Finding it on **any one page** accepts the whole PDF; a PDF where no page has it (or only another test's) is refused, and the message says so. The app keeps the **SHA-256 of the code** (`document.provenance[].access`) with every question it read from that PDF, never the code itself. There is no other way into the app: the four-file SAT import and unmarked PAA/TSI exports were removed. This is a deterrent, not copy protection: it runs in the person's browser.
- **Replacing a code.** The accepted hashes are in one small file, **`src/core/accessCodes.ts`** (`ACCESS_HASHES`, a list per test). To replace one: run `node scripts/access-hash.mjs "SAT-XXXX-XXXX-XXXX-XXXX"`, paste the hash it prints into that test's list, and release. Keeping the old hash in the list beside the new one lets both PDFs work for a while; removing it revokes the old PDFs.
- **Revoking.** Whenever the app loads it checks the stored PDFs against the hashes in that version and removes the questions of any PDF whose code is not among them (their images and import receipts too), then says how many in a notice. Answers and bookmarks stay, and adding a valid PDF brings the questions back under the same IDs. Examples and questions with no PDF behind them are never touched. **A PDF added before this existed recorded no code, so it is removed the first time the new version loads**; add the current PDF again.
- **Updating cannot be skipped.** When a new version has been downloaded, a pop-up like the Practice Test's pause covers the page and cannot be closed (no close button; Escape does nothing) until the person presses **Update now**. The page reloads into the new version, which re-checks the stored PDFs as above. A running timed test keeps its clock until then, as it would behind any other window.
- **SAT status.** The SAT PDF is one file with both tests and every status. A green **ACTIVE** or red **INACTIVE** badge at the top right of each page says whether the question is in a live College Board practice test; that sets `testStatus`. A page without a badge is `unknown` (explicit, not a promise of safety). The same ID printed ACTIVE in one place and INACTIVE in another is left out. IDs and source match the earlier four-file reader (`cb-<id>`, "College Board SAT question bank"), so questions imported that way are recognised by the new file and keep their answers and bookmarks.
- **Duplicates are avoided.** The same ID twice in a drop must agree (first copy used); the same ID again in a later drop is skipped or refreshed in place; and a bundled example is dropped when an imported question has the same ID (see [examples.md](examples.md)). Identity is by ID, never by similar wording.
- **Questions that run over several pages** (a long reading, a figure, long choices or a long explanation) are read across all their pages: the stem, the choices, the answer key and the explanation can each start or finish on a later page. Reading only the first page left 20 of the 3,770 SAT questions out ("Expected options A-D in order"), each of them a 2 to 4 page question.
- The code line and the badge are never in the question or explanation images, nor in the text: the explanation image ends just above the code line.
- A progress bar shows reading and preparing, and **Cancel** stops cleanly. Images already prepared are kept and reused on a rerun. Images that a re-prepared question no longer uses are removed automatically.
- The finished report lists how many questions were prepared and any left out with the reason. **Download report** saves it (source IDs, file names and hashes, no question text).
- The one SAT question known to print an option as a bullet (`e3bbf2bf`) is handled by a built-in reviewed exception (`src/importing/pdf/exceptions.ts`). The pop-up has no settings and no "Advanced" section.
- It needs WebP image saving (Chrome, Edge, or Firefox). The PDF reader is loaded only for this task and is kept for offline use after its first load.
- **Size.** The SAT PDF is about 4,000 pages. The file is read into memory whole, and the first-pass reading and the conversion each open it. Measured with a synthetic 118 MB, 4,000-page SAT PDF in the same layout (distinct IDs, badges and codes, one image per page) imported through the real dialog path in headless Chromium on 4 cores: about **5 minutes**, all 4,000 questions added with none left out (800 active, 3,200 inactive), about 350 MB written to the browser database, JavaScript heap about 125 MB, and about 2.1 GB resident memory across the browser's processes at its peak. A real file of ~260 MB with heavier images will need more of both, so close other heavy tabs; the tab must stay open while it works. If memory ever becomes a problem, the first pass can read page by page and the kind check can peek at the start of the file instead of loading it whole.

Design and parity notes for the original four-file import are in [the scope document](in-browser-pdf-import-scope.md); it is kept as history.

## Prepare or rebuild the library

> **Developer-only.** This Python tool and the local library server (`private-data/`) are the owner's own-machine path for the original four-file export. They do not check the access code and are not part of the app's import. Questions they produce record no code, so the app removes them when it loads, like any PDF without a valid code.

The Python utility is a preparation-time tool for this particular College Board export layout. It requires PyMuPDF and Pillow. They were installed for this laptop under ignored `private-data/python-deps/`; they are not runtime dependencies of the portal.

On a new installation, install `requirements-pdf.txt` with your Python environment, then run:

```powershell
python scripts/import_college_board.py --input-directory "C:/Users/<you>/Downloads" --active-mode active-only
```

This expects the four original names (`read_write_inactive.pdf`, `read_write_active.pdf`, `math_inactive.pdf`, `math_active.pdf`). It writes:

- `private-data/library/questions.json`: normalized metadata, answer keys, search text, and image references.
- `private-data/library/assets/`: original-layout image crops with SHA-256 filenames.
- `private-data/library/manifest.json`: library revision, asset inventory, and counts.
- `private-data/library/import-report.json`: source file hashes, page/ID coverage, status comparison, and any quarantined items.
- `private-data/pdf-cache/`: checksum-keyed extraction/rendering caches, used to resume preparation.

Use `--active-mode inclusive` only for equivalent exports where the active file includes all questions and the inactive file excludes active questions. IDs in both are inactive; inclusive-only IDs are active. If the inactive export is not a subset, the unmatched inclusive IDs stay unknown and the report records the inconsistency. With `--active-mode unknown`, only the explicitly inactive export is classified inactive and the other set remains unknown. Conflicting IDs in an active-only/inactive comparison are unknown. There is no fuzzy identity merging.

The browser validates the normalized schema and verifies both the question payload and image hashes. A prepared revision refreshes matched source definitions while preserving their internal IDs and existing study history. Generic JSON re-imports retain the original conservative duplicate-skip behavior.

## Layout and answer safeguards

- Equations, diagrams, tables, underlines, and original answer choices are preserved in image crops. Automatic text extraction is used for search, not as the authoritative visual question.
- PDF annotations are disabled while rendering. This removes answer-revealing highlights without modifying source files.
- Question crops stop before the answer key or rationale. Explanations are separate images shown after submission. Continuation pages remain attached to the same source ID.
- Numeric accepted entries come from the source answer key and explicit accepted-answer examples, including documented rounding variants. In 81 questions without a separate key line, an explicit correct-answer statement in the official rationale supplies the answer. The importer never solves a question or guesses an absent key.
- One source question prints its fourth choice as a nested bullet. It was visually reviewed against the rationale. Its private manual override lives in `private-data/pdf-overrides.json`, and the practice view shows a warning explaining how to read that option.
- All 3,770 IDs were imported; the final report contains zero quarantined questions. Unrecognized metadata, ambiguous answers, and unsafe crop boundaries cause quarantine rather than silent partial imports.

The four option-label edge cases were reviewed. Three were text-extraction false positives caused by initials or wrapped text; the fourth is the source-format warning above. Original question text is not edited to conceal an extraction issue.

## Limits and verification

Question images currently provide the most faithful display. The search transcript may omit vector math or contain PDF word-spacing artifacts, and image alt text is not a complete screen-reader transcript. A later semantic-text pass can improve accessibility and selection without changing source identity or progress records.

The preparation utility supports this observed PDF layout rather than arbitrary PDFs. Recheck the import report and representative pages when the export format changes. Cached assets from previous revisions are retained; no bulk deletion is performed during preparation.

Synthetic tests cover hidden annotations, answer-key separation, explicit rationale fallback, accepted rounding variants, schema/source validation, and image storage. A separate private-corpus check imports the complete bank into a disposable browser context, blocks all non-loopback requests, practices representative numeric/choice/reading questions, and verifies reload persistence. Browser-test profiles and output now use the Windows temporary directory, outside OneDrive.
