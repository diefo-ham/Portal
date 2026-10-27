# Durable sessions

Sessions remain inside Practice; there is no additional top-level destination.
Unfinished sessions appear first in Continue. Completed starred sessions follow
the practice composer, then up to three recent unstarred completed sessions. A
collapsed View all sessions list searches custom and automatic names. The
expanded history intentionally repeats the summarized groups only after the user
asks for the complete list.

`Session.name?: string` is the optional user override and `Session.starred?:
boolean` is the independent session favorite. Missing fields are valid, so old
IndexedDB records and backups need no migration. Names trim outer whitespace,
collapse whitespace runs, preserve Unicode, and stop at 80 Unicode code points.
Clearing a name restores the automatic label. Session stars never affect question
bookmarks, membership, ordering, scoring, or results.

Automatic labels are derived rather than stored. They combine a queue source
when available (Mistakes, Unanswered, or Bookmarks), the actual section, a
single common skill or domain when concise, and the question count. Mixed sets
fall back to Mixed practice rather than enumerating filters.

Opening an unfinished session resumes its saved order and index. Opening a
completed session shows its immutable results. Practice again creates a distinct
shuffled session with new attempts; it never modifies the old record. A custom
name is inherited with a restrained Repractice suffix. Retry subsets inherit a
custom name with Mistakes or Unanswered; otherwise their automatic labels derive
from the retry filters and membership.

Full backups validate both optional fields. Progress reset removes named/starred
sessions exactly like all sessions. The existing single reset archive copies the
complete session records and therefore restores names and stars without a new
archive format or database version.

There is intentionally no deletion command, folder/tag system, manual sort,
session duplication editor, or separate session backup. Review retains detailed
performance and question outcomes; Practice exposes only identification, simple
progress/result context, rename/star actions, resume/open, and repractice.
