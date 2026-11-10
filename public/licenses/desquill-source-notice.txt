# DesQuill local editor

Unmodified upstream source from https://github.com/desmosinc/desquill at
`de33da1c698541be6d1252948e55983b2e81055e`, retrieved 2026-10-27.
Source is MPL-2.0, including the bundled Symbola subset and upstream vendor notices.
This is the open-source formula editor, **not** the proprietary hosted Desmos calculator.

`node scripts/build-desquill.ts` rebuilds `desquill.js` and `desquill.css` from
the retained source using esbuild and Sass. No upstream source modifications.
The adapter in `src/calculator/MathEditor.tsx` and parser in `latex.ts` are portal code.

MPL 2.0 license text: https://www.mozilla.org/MPL/2.0/
Source remains available in this directory when distributing the application.
