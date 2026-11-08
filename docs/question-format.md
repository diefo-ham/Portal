# Normalized question JSON, version 1

An import is an object with `schemaVersion: 1` and a `questions` array. The importer validates the entire file before one atomic storage mutation. Limits: 50 MB per file, 20,000 questions per import. Imported text is rendered as text, never HTML. Unknown fields are ignored. Missing optional fields are displayed as unspecified; missing `testStatus` becomes `unknown`.

```json
{
  "schemaVersion": 1,
  "questions": [
    {
      "id": "my-set-math-001",
      "source": "My original practice set",
      "sourceId": "M001",
      "section": "math",
      "domain": "Algebra",
      "skill": "Linear equations in one variable",
      "difficulty": "easy",
      "stem": "If 2x + 1 = 9, what is x?",
      "choices": [
        { "id": "A", "text": "3" },
        { "id": "B", "text": "4" }
      ],
      "answer": { "type": "choice", "value": "B" },
      "rationale": "Subtract 1, then divide by 2: x = 4.",
      "testStatus": "inactive"
    }
  ]
}
```

| Field                | Required           | Meaning                                                                                                                        |
| -------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `id`                 | Yes                | Stable internal string ID, unique in a file; prototype-related names rejected. PAA IDs must start with `paa-`; SAT IDs must not |
| `source`, `sourceId` | No                 | Source namespace and its original question ID; together the strongest duplicate key                                            |
| `assessment`         | No                 | `SAT` (default) or `PAA`; see [the PAA notes](paa.md)                                                                          |
| `section`            | Yes                | SAT: `math` or `reading-writing`. PAA: `lectura`, `redaccion`, `matematicas` or `ingles`. Must belong to `assessment`.         |
| `passageGroup`       | No                 | Questions that share a reading carry the same group id; sessions keep them together                                            |
| `domain`, `skill`    | No                 | Free text, preferably consistent across imports                                                                                |
| `difficulty`         | No                 | `easy`, `medium`, `hard`                                                                                                       |
| `passage`            | No                 | Plain text preceding the question; newlines preserved                                                                          |
| `stem`               | Yes                | Nonempty question text; Unicode symbols and newlines supported                                                                 |
| `choices`            | For choice answers | At least two `{id, text}` objects with unique IDs                                                                              |
| `answer`             | Yes                | Choice ID or accepted numeric strings, as below                                                                                |
| `rationale`          | No                 | Explanation, shown only after submission                                                                                       |
| `testStatus`         | No                 | `active`, `inactive`, or `unknown`; default unknown                                                                            |
| `media`              | No                 | Array of `{alt, dataUrl}` with nonempty accessible text and embedded PNG, JPEG, or WebP base64 images; no remote images or SVG |
| `importMetadata`     | Storage managed    | Import time, filename, and parser version, assigned by the importer                                                            |

Numeric response questions omit choices:

```json
"answer": { "type": "numeric", "accepted": ["3/8"] }
```

`0.375` and `6/16` are equivalent to `3/8`. Scoring uses relative tolerance `1e-9 * max(1, abs(expected))` to accommodate floating point arithmetic, **not** general rounding to a number of decimal places. If rounded answers are valid, enumerate them (for example `['1/3', '0.333']`). Decimal numbers and simple fractions are accepted; expressions, units, scientific notation, commas, and zero denominators are rejected. This is explicit MVP scoring, not a claim to reproduce all official SAT student-response rules.

## Duplicate policy

- Exact `(assessment, source, sourceId)` match: skip the incoming entry, retain existing content, status, and progress. Use a stable source namespace across equivalent exports. Re-import does not silently change active/inactive classification.
- Same internal ID and same question content: skip an exact duplicate.
- Same internal ID but conflicting content: reject the complete import rather than overwrite history.
- Different IDs without a source-ID match: retain both. No fuzzy merging. A future content-fingerprint tool should propose matches for review rather than merge uncertain items automatically.

## Adding a parser

1. Parse a legitimately obtained source file outside the UI/storage layers.
2. Retain original source IDs and provenance. Represent uncertain fields honestly.
3. Extract figures as embedded supported images with accessible descriptions. Verify question layout, options, answer key, and rationale alignment.
4. Emit the versioned normalized envelope and pass it through `parseQuestions`.
5. Provide an import preview and warnings before committing when extraction is imperfect.

The supplied PDF exports are handled by `scripts/import_question_bank.py`. Their active-only meaning was confirmed by the user; the preparation report retains the classification mode and source file hashes. Keep sources and generated question material outside Git. Paired inclusive/exclusive comparison must first establish identical export filter scope and reliable question identity.

## Original PDF representation

Questions may have an optional `document` object:

```json
{
  "document": {
    "question": [
      {
        "src": "asset:<64-character-sha256>.webp",
        "alt": "Original question content",
        "width": 1160,
        "height": 400
      }
    ],
    "rationale": [
      {
        "src": "asset:<64-character-sha256>.webp",
        "alt": "Original explanation",
        "width": 1160,
        "height": 600
      }
    ],
    "textIsApproximate": true,
    "answerKeyOrigin": "answer-key",
    "provenance": [
      {
        "filename": "user-export.pdf",
        "sha256": "<64-character-source-sha256>",
        "pages": [1, 2]
      }
    ]
  }
}
```

Each panel requires a safe asset reference or embedded PNG/JPEG/WebP data URL, alt text, and finite positive image dimensions. Each group contains 1–30 panels. No HTTP URLs, HTML, SVG, or path traversal references are accepted. `answerKeyOrigin` can be `answer-key` or `rationale`; optional `extractionWarnings` is an array of plain-text messages shown with the question. Provenance page numbers are one-based.

For document-backed multiple-choice questions, choices retain IDs and generic labels; the original choices are visible in the question image. Structured `stem` and `rationale` remain available for search and future conversion, but visual practice uses the preserved layout. Only the rationale panel group appears after submission.

