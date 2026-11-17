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

## Reset

A progress reset clears one test's answers, sessions, drafts and recorded time in
one transaction: a failed write changes nothing. Bookmarks are kept unless the
checkbox is selected. Questions, import receipts and preferences are untouched.
The confirmation says that a reset cannot be undone.

Earlier versions also saved a restorable copy of the study state before each
reset (`reset-archive`, `reset-archive-PAA`, `reset-archive-TSI` in IndexedDB)
and offered "Restore previous study state". That was removed on 2026-11-17:
the app now deletes any such copy when it loads, and offers no restore. A full
backup file is the way to keep a copy of progress.

## Verification

Core tests cover independent unfinished sets, reset, corpus preservation,
transaction rollback, and removal of a stored reset archive. Browser checks cover
pointer and keyboard bookmarking, B isolation in numeric inputs/dialogs,
independent resume after reload, bookmark practice, reset cancellation, bookmark
clearing/preservation, removal of an old archive on load, theme preservation, and
keyboard navigation after a reset. Existing workflow/visual checks exercise both
themes, laptop/mobile widths, offline requests, filtering, active protection,
calculator state, PDF assets, backups, and session outcome/repractice routes.

Evaluate whether three visible Continue entries and the new bookmark route feel
appropriately quiet in daily use, and whether 1–4 feels natural for answer choice
selection alongside B for bookmarks.

## Question-browser and composer refinement

Practice now accepts a typed whole-number session size from 1 through the live
filtered count. Invalid, empty, zero, fractional, or over-maximum values cannot
start a set. Filter changes do not silently rewrite the user's number; the live
maximum and disabled Start action make a newly invalid value explicit.

Browse no longer starts or resumes sessions. It searches and filters the same
question corpus, shows answer/bookmark metadata, and opens a read-only question
surface with bookmarking plus previous/next navigation through the current match
set. It does not reveal explanations or record answers. Active questions still
require spoiler confirmation before opening when protection has been overridden.

The header order is Practice, Review, Browse, Help, Settings, aligned toward the
right at laptop widths. Help explains Practice versus Browse, active-question
protection, exact answer-status behavior, saved sessions, and shortcuts using
short expandable sections. Domain/Skill popovers and non-destructive Help and
Practice dialogs dismiss on outside click. Reset confirmations and the calculator
remain exempt.
