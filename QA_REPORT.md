# Portal QA — 3 October 2026

## Result and scope

`npm test` passed **71 tests, 0 failures**, in 100.9 seconds. The separate
50-connection PostgreSQL load test also passed.

The sample expansion adds 20 bilingual Cyber Security awareness questions
and expands each other subject to 25 bilingual questions. The public final
exam bank now has 40 MCQs, 16 written questions and 8 practical tasks.
Additional tests validate complete content, answer keys and guides, repeatable
SQL generation, and adding samples through every subject's admin page.
Existing edited answers, hidden drafts and sort order are preserved.
The sample builder now preserves the subject schema when regenerating the
exam seed, including upgrades from the older format without end markers.

The fixes were checked with automated Edge/Chromium browser scenarios,
PostgreSQL schema tests and a separate load test using 50 independent
PostgreSQL connections. Browser checks cover mobile (390 × 844) and desktop
layouts. Acceptance scenarios were executed by automation; the owner has
not performed a separate sign-off.

The database-backed browser tests use the application's actual SQL functions
and tables in local PGlite, with a test transport and simulated admin session.
The load test uses a separate PostgreSQL 18.4 server and the public `anon`
role. No student registrations, answer writes or deletions were made against
the live Supabase project. Five live public REST reads of questions and
settings returned HTTP 200 in approximately 1.1 seconds each.

## Fixes verified

- Bundle Supabase locally and load Google fonts without blocking startup.
- Bound API requests, including response body reads, to 15 seconds.
- Prevent configured quizzes from starting while loading, after a failed
  settings read, or with an empty bank. Provide a retry control.
- Keep older subject/page responses from overwriting the current admin view.
- Disable settings saves until a successful read and retain useful retry messages.
- Keep a recovery token before the first exam start request, so a lost response
  can resume the same paper after the SQL migration is installed.
- Allow an existing paper to resume after new registrations are closed.
- Coalesce rapid answer changes and save the latest choice before submission.
- Lock answers/navigation during submission and support failed-submit retry.
- Keep quiz retakes saving separately and prevent duplicate finish handling.
- Handle closing question editors while saves are pending; prevent repeated
  grading/finalization clicks while their requests are pending.
- Run practice modes without quiz/exam database reads.

## Browser acceptance scenarios

| Area | Scenarios |
| --- | --- |
| Subjects | Cyber Security, Video Editing, Graphic Design and Basic Computer: navigation, settings persistence, editing, hide/show, student answers, retakes, results and feedback. |
| Admin pages | Subject dashboard, questions, results, feedback and settings; exam dashboard, question bank, results and settings. Subject switching and polling lifecycle. |
| Final exam | Real database-backed registration; MCQ, written and practical answers; refresh and resume with registration closed; submit; reject incomplete marking; grade; finalize; export full Excel paper; delete test result and cascading answers. |
| Excel imports | All five templates; download/fill/upload/preview/save/reload; correct answers and marking guides; draft state; optional fields; duplicate/conflict detection; malformed files, formula cells and wrong subject; 500 rows; safe retries after a lost save response. |
| Result exports | Individual, selected and complete exports; more than 1,000 results; long multiline answers; formula-like content as text; failed reads produce no partial workbook. |
| Loading/recovery | Slow requests, failed settings reads, retry, empty banks, late responses, pending editor save, lost start response, slow autosave and slow/failed submission. |
| Public UI | English/Bangla switches preserve answers, timers and scores; corrupt local storage recovery; offline demo and practice; mobile overflow checks. |
| Authentication | Empty/invalid login errors, simulated authenticated navigation and a real bundled Supabase client over intercepted REST. Live admin login requires the owner's credentials and was not exercised. |

## 50-student load test

Raw results: [qa/load-50.json](qa/load-50.json).

This load run was recorded before the sample expansion; the expansion
does not change the exam RPCs.

All 50 students started different papers concurrently, resumed the same
paper with their tokens, saved answers, pinged, submitted and retried
submission. Wrong-token writes were rejected. The test verified:

- 50 submitted papers and 1,250 saved answers.
- 2,000 answer-save requests, including four revisions of each written/practical answer.
- All 250 written/practical answers retained their final revision.
- 200 quiz results across the four subjects.
- Idempotent repeated submissions and no cross-student paper IDs.

| Operation | Requests | Local p95 |
| --- | ---: | ---: |
| Start | 50 | 145.89 ms |
| Resume | 50 | 10.96 ms |
| Save answer | 2,000 | 9.97 ms |
| Ping | 50 | 7.78 ms |
| Submit | 50 | 7.66 ms |
| Submit again | 50 | 6.33 ms |

This measures concurrent database operations on the local machine. It does
not simulate 50 browser devices over the venue network or prove the capacity
of the live Supabase hosting plan. Browser autosave coalescing reduces extra
requests when students change answers rapidly.

## Apply and reproduce

1. Update the deployed site from the updated GitHub branch.
2. Run [migrations/20261003-exam-recovery.sql](migrations/20261003-exam-recovery.sql)
   in the Supabase SQL Editor for an existing installation. It replaces only
   `exam_start`, inside a transaction, and preserves existing data. GitHub
   pushes do not apply SQL migrations. Database administrator access was
   unavailable in this workspace, so the live migration remains to be applied.
3. For a fresh database, use the updated `supabase-schema.sql` instead.
4. Run `npm ci` and `npm test`. Browser tests use installed Microsoft Edge by
   default. With Playwright Chromium installed, use `BROWSER_CHANNEL=chromium`.
5. For the load test, create an empty local UTF-8 PostgreSQL database named
   `hacknfix_qa`, set `QA_POSTGRES_URL`, and run `npm run test:load`.
   The script refuses remote, differently named and nonempty databases.

Example in PowerShell:

```powershell
$env:QA_POSTGRES_URL = 'postgres://USER:PASSWORD@127.0.0.1:5432/hacknfix_qa'
npm run test:load
```

The scripts are repeatable checks of the covered scenarios. They do not
establish that every possible browser, device, network failure or future
question bank change will be bug-free.
