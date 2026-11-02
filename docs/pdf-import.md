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

**Settings → Your questions → Add your question PDFs** does the same job as the Python tool without installing anything. Choose the four exports (the names are matched; browser copies such as `math_active (1).pdf` are accepted) and press **Add questions**. There is nothing to decide: the active and inactive files of each subject are told apart from their contents. Files with no question in common are an inactive set and an active set; an active file that contains every inactive question is an inclusive set; if the overlap is uneven the questions that cannot be proven are marked unknown. A note under the result explains which reading applied.

- A progress bar shows reading and preparing, and **Cancel** stops cleanly. Images already prepared are kept and reused on a rerun. Images that a re-prepared question no longer uses are removed automatically.
- The finished report lists how many questions were prepared and any that were left out with the reason. **Download report** saves it (source IDs, file names and hashes, no question text).
- The optional **Reviewed exceptions** file (under Advanced) is JSON keyed by source ID, for example `{"e3bbf2bf": {"choiceLabelsVerified": true, "warning": "Option D is printed as a bullet."}}`. It is the same idea as `private-data/pdf-overrides.json`; supply it only for questions you have checked by eye. The one question in the supported exports that prints an option as a bullet (`e3bbf2bf`) is already built in (`src/importing/pdf/exceptions.ts`), so the full set imports with no file.
- It needs WebP image saving (Chrome, Edge, or Firefox). The PDF reader is loaded only for this task and is kept for offline use after its first load.
- Images are drawn by a different renderer than the Python tool, so they match visually but not byte for byte. A library prepared this way is a new revision; it replaces matching questions by source ID and keeps your answers, notes, and bookmarks. Preparing with both tools stores the images twice.

Parity with the Python tool and the design are recorded in [the scope document](in-browser-pdf-import-scope.md).

## Prepare or rebuild the library

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
