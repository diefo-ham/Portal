# Focused usability refinement

This pass follows Stage 4; its visual tokens, theme behavior, reading surfaces,
calculator, and question rendering remain unchanged.

- Practice shows the three most recent unfinished sets near the top, with any
  others under “More unfinished sets.” Starting another set no longer finishes
  existing work. Each set owns its order, position, drafts, and timer records.
  This supersedes the single-open-session rule documented in earlier stages.
- Review exposes Bookmarks as another practice source. It uses the existing
  shuffled-session flow and the same active-question protection as other queues.
  Browse/Refine selection retain their bookmarked-only filters.
- Pointer bookmarking restores reading focus; keyboard activation preserves the
  star's focus/pressed state. B bookmarks while reading. Because B previously
  selected answer B, 1–4 now provides a complete answer-selection shortcut;
  A/C/D remain available, and focused radio controls retain letter behavior.
  Help is available in navigation and the existing Practice tools panel.
- Settings uses ordinary vertically spaced groups without nested maintenance
  frames. Direct question-file import/sample download actions are absent from
  Settings. Corpus counts, import receipts, full backup export/restore, and the
  administrative parsing/prepared-library architecture remain. The empty-library
  synthetic example fallback is retained for development and fresh installations.

## Reset recovery contract

`state/reset-archive` in IndexedDB holds at most one `sat-study-reset-v1` envelope:
creation time plus attempts, sessions, and annotations. No corpus bytes, import
receipts, preferences, or recursively nested archive are copied. Database version
2 and the current study snapshot format are unchanged. The snapshot and reset
commit in one transaction: a failed write cannot clear progress without saving
the archive. Reset still preserves bookmarks unless the checkbox is selected;
the archive always captures all pre-reset bookmarks, even when they are cleared.

Recovery appears only for a valid archive, confirms that it replaces current
study records (including bookmarks), and validates again inside its transaction.
It restores original session membership/order/position, drafts, answers, recorded
time, annotations, and completed/unfinished status. Recovered timers are paused;
unanswered/mistake/accuracy views derive from the restored records. Existing
question data and preferences are untouched. Missing corpus references or corrupt
records cause rejection rather than partial recovery.

Recovery keeps the archive for repeat recovery; it does not create a swap/history.
Only another confirmed reset replaces it, including a reset of empty progress.
The confirmation explains this. Later work therefore does not overwrite the
archive until another reset. Full backup files retain their existing format and
do not include this browser-local safety archive. Clearing browser storage removes
it. No profiles, authentication, graphing engine, or native PDF typesetting added.

## Verification

Core tests cover independent unfinished sets, complete reset recovery, replacement,
corpus preservation, and transaction rollback. Browser checks cover pointer and
keyboard bookmarking, B isolation in numeric inputs/dialogs, independent resume
after reload, bookmark practice, reset cancellation, bookmark clearing/preservation,
archive recovery after reload, repeated-reset replacement, theme preservation, and
keyboard navigation after recovery. Existing workflow/visual checks exercise both
themes, laptop/mobile widths, offline requests, filtering, active protection,
calculator state, PDF assets, backups, and session outcome/repractice routes.

Evaluate whether three visible Continue entries and the new bookmark route feel
appropriately quiet in daily use, and whether 1–4 feels natural for answer choice
selection alongside B for bookmarks.
