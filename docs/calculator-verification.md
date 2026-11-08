# Calculator pass verification — 2026-10-27

> **The hosted reference calculator was retired on 2026-11-03.** The portal now has one calculator, the bundled Offline engine. Parts of this note that describe a hosted reference calculator mode are historical. See [Offline calculator vs the reference calculator](calculator-vs-desmos.md) for the comparison that led to this.

## Expression and graph parity refinement

- Production build and all 87 core/math/storage/import tests passed.
- All 21 calculator and Practice-keyboard Edge workflows passed together.
  Focused coverage includes typed/pasted range round trips, x-dependent names,
  downstream updates, divider drag/keyboard bounds/ratio recovery, outer-window
  resizing, equal circle geometry, narrow fallback, POI toggling/empty clearing/
  mode disable, radical trig intersections, color/visibility controls and color
  persistence after session exit/reload.
- Existing mocked reference calculator failure/retry, lazy loading, independent workspace,
  completion and reset/archive tests remain green. The run exposed a viewport
  effect overwriting an immediate Offline edit; viewport updates now merge with
  the latest workspace, and the original engine-switch test passes unchanged.
- Live official reference calculator v1.12 checks verified ascending/descending/stepped lists,
  endpoint rounding and invalid steps, and the named-expression example's
  graphability and values. `p(2)=10`, `v(2)=7`; the combined curve gives 57, 17,
  and 1 at x=2, 0 and −2 respectively. Test math was synthetic; no question data
  was sent. Both native and Offline graph screenshots were visually inspected.
- No dependency or database-version changes. Optional per-entry color fields are
  backwards compatible; the split ratio is a device-local UI preference.
  See [behavior and limits](calculator-expression-parity.md).

## Current stabilization pass

- Production build and all 81 core/math/storage/import tests passed.
- All 16 calculator/keyboard Edge workflows passed in the final targeted run.
  This includes actual keystroke regression entry, exact quadratic display/export,
  held/repeated table deletion, multi-POI selection/deselection, keyboard refocus,
  fractions, shorthand, grids/narrow curves and Escape confirmation/isolation.
- Thirty other portal workflows passed in the broad regression run. The existing
  timing checkpoint test remains intermittent: one run observed an exit cleanup
  write arrive after its first snapshot; another had a 2773 ms submitted duration
  against 3051 ms in the elapsed map. This same issue predates this pass. Timing
  implementation and that timing assertion were not changed or weakened.
  The unchanged timing test passed in its final isolated recheck (9.2 seconds),
  confirming the intermittent boundary rather than an all-green full-run claim.
- The keyboard Space test now verifies both checkbox toggle directions relative
  to its initial preference rather than assuming the timer starts hidden.
- Live official v1.12.0 loaded successfully with the supplied key, including at
  the usual production address after a verified local-server restart. No key is
  committed or embedded in build output; `.env.local` is ignored. Source/build
  scans found no copy of the real key.
- Live synthetic checks verified native quadratic/noisy exponential/custom
  sine-basis regressions, table data, `sinx` typing, fraction/decimal conversion,
  `(π/2,1)` POI labels and moving curve tracing while dragging. The reference calculator's native
  trial-key notice remains visible and unmodified.
- Light/dark laptop screenshots were visually inspected. Window checks cover
  desktop bounds, pointer/keyboard geometry, mobile fallback and unchanged
  question layout. Offline tests record/abort external requests and observe none.
- No dependencies, license changes, study-schema migration or question-content
  conversion. See [stabilization details](calculator-stabilization.md).

## Floating-window follow-up

- Production build and 76 core/math/storage/import tests passed. New numerical
  checks cover through-origin and sparse quadratic fits, restricted custom model
  rejection, real parameter-point metadata, and window bounds.
- The complete 43-workflow installed-Edge suite passed with one worker, including
  unchanged Practice/Review/Browse, timer, filters, sessions, reset/archive and
  keyboard checks. A prior parallel run again reproduced the previously documented
  timer snapshot mismatch (2770 ms submitted vs 3019 ms elapsed); timer logic and
  its assertion were not changed. It passed in the complete serial recheck.
- Calculator tests cover unchanged question geometry, pointer title dragging,
  width/height/diagonal resize, keyboard resize, min/max bounds, reopening,
  viewport recovery, narrow overlays, immediate Clear, graph-local tracing,
  POI labels and slider-controlled point dragging. Light/dark screenshots were
  visually inspected at laptop sizes, including attached coordinate labels.
  All 11 calculator-specific Edge workflows passed again after final coordinate
  rounding/focus styling, including POI hover/pinning/focus/dismissal checks.
- Hosted API boundary mocks verify primary/default the reference calculator with a configured key,
  the always-enabled the reference calculator button without a key, no external requests while
  Offline is selected, retry-only connection attempts, failed/slow scripts,
  preservation of an already-loaded instance after an offline event, independent
  saved work, completed-session reopening and reset/archive recovery.
- Live embedded reference calculator regression/tracing/POI behavior still requires a real API
  key for acceptance. No genuine key was supplied. Documented official options
  were checked against current API v1.12 docs; no claim of new live-key testing.
- No new dependencies, source-PDF conversions or study logic changes.

## Original dual-engine pass

- Production TypeScript/Vite build passed.
- 73 core/math/storage/import tests passed, including independent known fits,
  noisy original-y exponential fitting checked against current reference calculator, structural
  LaTeX conversion, implicit multiplication, trig domains/units, lists and backup
  validation. Legacy named definitions remain readable.
- The full 40-test Edge browser suite passed with two workers. The final focused
  eight calculator workflows passed again after the last conversion/fit-label
  changes and rebuilding the pinned local editor bundle.
- Both portal themes and widths 390, 820, 1024, 1280, 1366 and 1920 were checked
  for overflow and usable calculator layout. Light/dark expanded and side-panel
  screenshots were visually inspected; only synthetic questions were used.
- Offline workflow tests abort/record every non-loopback request and observed
  zero external calculator requests. Localhost remained available, matching an
  internet outage rather than disabling the local server itself.
- Mocked official API tests exercise success, script failure, 6.5-second timeout,
  network disappearance, explicit retries, separate native/opaque workspaces,
  unfinished-session exit/reload/resume while the hosted API is unavailable,
  reconnection, completed-session reopening, Clear, and reset-archive recovery.
  The mock implements only the documented API boundary; it contains no reference calculator code.
- No genuine API key was supplied. Live loading of the embedded API with the user's
  own key remains a manual acceptance check. The public the reference calculator website was used
  for the representative comparisons recorded in `calculator-parity.md`.
- The first high-concurrency full run had one intermittent pre-existing timing
  assertion fail: a submitted duration and the saved elapsed map differed by about
  one timer tick. The unchanged test passed in isolation and in the complete
  two-worker run. Timer logic was deliberately left outside this calculator pass.
- Added package installation audit reported zero known vulnerabilities. The editor
  uses the esbuild version already present through Vite, avoiding a second version.

Manual acceptance: supply an official key, compare both workspaces during a school
network interruption, and evaluate structural cursor movement, fractions, table
navigation and graph/expression density on the actual laptop. Screen-reader behavior
and exhaustive the reference calculator equivalence are not claimed by these automated checks.
