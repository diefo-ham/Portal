# Calculator pass verification — 2026-10-27

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
- Hosted API boundary mocks verify primary/default Desmos with a configured key,
  the always-enabled Desmos button without a key, no external requests while
  Offline is selected, retry-only connection attempts, failed/slow scripts,
  preservation of an already-loaded instance after an offline event, independent
  saved work, completed-session reopening and reset/archive recovery.
- Live embedded Desmos regression/tracing/POI behavior still requires a real API
  key for acceptance. No genuine key was supplied. Documented official options
  were checked against current API v1.12 docs; no claim of new live-key testing.
- No new dependencies, source-PDF conversions or study logic changes.

## Original dual-engine pass

- Production TypeScript/Vite build passed.
- 73 core/math/storage/import tests passed, including independent known fits,
  noisy original-y exponential fitting checked against current Desmos, structural
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
  The mock implements only the documented API boundary; it contains no Desmos code.
- No genuine API key was supplied. Live loading of the embedded API with the user's
  own key remains a manual acceptance check. The public Desmos website was used
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
and exhaustive Desmos equivalence are not claimed by these automated checks.
