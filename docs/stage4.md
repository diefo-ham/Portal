# Stage 4 — Visual system and polish

## System

`src/ui/tokens.css` contains semantic colors, reading/UI font stacks, spacing increments, control height, radii, focus, and motion values. `styles.css` replaces the accumulated styling with one shared set of rules rather than adding another theme override layer. There are no new packages, downloaded fonts, external assets, or design-system framework.

Light uses oat paper, ivory reading surfaces, moss controls, olive ink, and terracotta errors. Dark uses peat/umber, walnut surfaces, parchment text, lichen/ochre controls, and muted brick feedback. Surfaces, dropdowns, input controls, dialogs, selected states, warnings, backup/restore controls, results, and source panels all use the same semantic tokens. Tested normal text token pairs meet 4.5:1 contrast in both palettes.

Reading uses a local academic serif stack (Iowan Old Style, Palatino Linotype, Book Antiqua, Georgia); controls use Segoe UI/Calibri/Trebuchet MS. Page titles are 26–32 px rather than hero-sized. Question text is 24 px on laptops, passages 20 px with a 1.7 line height, and choice content 19 px. Browser-resolved font availability determines the exact face. Imported PDF typography remains raster source content, so it does not acquire the UI's serif typeface.

## Presentation

- Home's composer uses aligned controls and thin section rules without a surrounding card. Continue uses a muted tonal strip. Start remains a compact 40 px primary control. Navigation is quieter and aligned with the content.
- Practice uses one ivory/walnut reading sheet with a bounded measure. Metadata, bookmark, progress track, and utility actions remain subordinate. Choices, numeric entry, focus, selection, incorrect/correct states, and feedback share consistent spacing and radii. Feedback uses a subtle tone and a narrow semantic edge rather than a heavy box.
- Calculator uses a separate toned surface, stays resizable on wide screens, and stacks below the question at up to 1,100 px. This is the only layout breakpoint adjustment with a functional usability purpose: it prevents source math from shrinking beside a calculator on smaller laptops. Calculator operations and state handling are unchanged.
- Review routes use typography and a divider instead of two framed cards. History and results retain their existing actions and three outcomes. The small outcome bar remains; no new charts or metrics were introduced.
- Settings and maintenance use ordinary grouped sections. Dropdowns and modal dialogs receive the stronger boundary/shadow reserved for temporary layers. Controls have consistent heights, visible keyboard focus, restrained hover/pressed states, and clear disabled states.
- Motion is limited to short popover/dialog/feedback reveals and progress/state transitions. Reduced-motion preferences remove transitions and animations.

## Appearance behavior

`appearance.ts` applies the preference before React mounts. Auto is the default and follows live `prefers-color-scheme` changes; explicit Light/Dark overrides it. `AppearanceSettings.tsx` manages this presentation-only preference. Appearance and browser theme-color update together. Keys `sat-theme` and `sat-pdf-original` are separate localStorage preferences and survive progress resets. No study record or database schema changes are required.

Most of the real corpus consists of original PDF images. In light mode, multiply blending places them on warm paper. In dark mode, a display-only inversion/sepia/brightness treatment blends them into the brown sheet with light text and visible diagram lines. **Keep original PDF colors** in Settings disables this treatment and uses the unchanged source image on white paper. This matters for color-coded figures or references to black/white regions; adapted colors should not be treated as the original figure colors. Ordinary imported media is never inverted. No PDF/image bytes, source crops, question wording, scoring, or figures are rewritten.

## Scope preserved

Information architecture, session generation, deterministic resuming, history/retries, unresolved queues, bookmarks, multi-select semantics, active protection, reset options, calculator provider, persistence, and corpus preparation are unchanged. The current explicit rule remains one unfinished session plus multiple historical sessions; this stage does not introduce simultaneous open-session management.

## Verification

- Production TypeScript/Vite build and 17 core/storage tests.
- All 16 Edge workflows: the existing 12 regression flows plus Auto/live system switching and persistence/reset, both themes across major screens, contrast/focus and responsive checks, and long reading/dense PDF table/reduced-motion/original-color checks.
- Laptop/desktop widths 1,024, 1,280, 1,366, and 1,920 px, plus 820 px calculator and 390 px narrow-layout checks. No unintended document-level horizontal overflow in tested states.
- Inspected rendered light/dark Home, practice, long reading, table/math, calculator, tools, question details/map, feedback, results, Review, Browse, Settings, and reset confirmation.
- Private corpus check loaded all 3,770 questions and 7,731 assets in an isolated browser with non-loopback requests blocked; verified domain/skill coverage, answers/explanations and reload persistence, plus representative numeric Math, choice Math, a table, and a large reading/graph question in both themes. No browser errors. Screenshots remain ignored private data.

The next subjective evaluation should focus on paper warmth, dark-theme brightness, source-PDF readability, choice density, and the calculator stacking point on the user's school laptop. No further broad redesign is included.
