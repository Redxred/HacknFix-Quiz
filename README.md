# HacknFix

A bilingual (বাংলা / English) cyber-awareness quiz for everyday Bangladeshi
internet users — Facebook, IMO, bKash, bank apps and public wifi scams.

Ten scenario questions, an explanation after every answer, and a shared
leaderboard.

Visitors can rate the quiz and leave a comment in either language. The admin
panel has a live dashboard — visitors, where they came from, what they browse
on, where they drop off — alongside the questions, results and feedback.

There is a second half: a graded **final exam** for cyber security and
ethical hacking students. Registration is mandatory, MCQs are timed at 30
seconds each and marked automatically, written and practical answers are
marked by hand in the admin panel, and every attempt to copy, paste, switch
tab or open developer tools is logged against the paper. Correct answers
never leave the database, so there is nothing in the page to read.

See [SETUP.md](SETUP.md) to get it running.

Run locally with `npm start` (Python required), then visit
<http://localhost:8000>. The admin panel is at `/admin.html`.

The student site opens with four subject choices: **Cyber Security**, **Video
Editing**, **Graphic Design** and **Basic Computer**. Cyber Security contains
the existing Awareness Quiz and Final Exam. The other subjects have their own
bilingual quizzes with starter questions. In the admin, Cyber Security opens
one folder containing its Awareness Quiz and Final Exam workspaces. Each quiz
and the final exam retain separate questions, results, feedback and
analytics can be reviewed individually. Run the latest `supabase-schema.sql`
in Supabase to enable the new subject workspaces on the live site.

Both Results pages can download an Excel workbook for **all** student
results, fetched across every database page. Each result row has an Excel
button for an individual download. In Final Exam Results, **Excel**
includes every question, all MCQ options, student answers, marks, feedback and
the violation log. The dashboard's **Recent results** also has an **Excel**
button beside **Review** for the same individual full-paper download.
The workbook opens on **Full exam paper**, with student details followed by
each question and the student's answer. Long answers continue on additional
rows so the whole response stays readable. Summary and analysis sheets follow.
**Delete** in Final Exam Results or the dashboard's Recent results removes one
attempt after confirmation, including its answers, marks and violation log.
The student's profile and other attempts remain. Quiz Results also supports
individual deletion.
Use the row checkboxes to choose papers, **Select shown
papers** for the current filter, or **Select all papers (all pages)** for the
whole database, then **Download selected full papers**. The combined workbook
identifies each answer by student and attempt; selection survives filtering.
**All results summary Excel** provides scores without the full papers. The CSV
option exports only the rows currently loaded and visible.

Final Exam opens on its own dashboard: all-time totals, current and expired
attempts, saved-question progress, time remaining, marking queues, recent
results and violation events, submission trends, score distribution, and
question-bank readiness. Open or close new registrations from this page.
It refreshes every 20 seconds, pauses in a background tab, and stops when
you leave the dashboard. Monitoring shows saved activity, not verified
online presence. List and chart limits are labelled in the interface.

Try the new public practice bank immediately, without registration:

- `/index.html?practice=mcq` — 40 MCQs.
- `/index.html?practice=written` — 16 written/CQ questions.
- `/index.html?practice=all` — all 64 samples, including 8 practical tasks.

Practice answers stay in memory and disappear when you leave. At the end,
students can review MCQ answers and written marking points. Practice does
not create an exam attempt or send answers to Supabase.

To put the samples in the live bank, sign in to **Final Exam → Exam
questions → Add 64 sample questions**, or run `sample-questions.sql` in
Supabase. Existing samples are skipped. These questions and answer guides
are public; replace them with your own material for a graded exam.

Each subject's admin **Questions** page also has an **Add sample questions**
button. Video Editing, Graphic Design and Basic Computer each include 25
bilingual MCQs with explanations. Cyber Security includes 20 new bilingual
awareness questions in addition to the original 10. Importing samples skips
matching prompts and preserves existing answers and draft visibility.
New questions are appended after the bank's current sort order.

For an existing database, run [subject-questions.sql](subject-questions.sql)
to add all quiz samples, or use the buttons in each subject. These SQL seeds
and buttons add questions to the live bank; updating GitHub files alone
does not change existing database rows. No schema migration is needed for
the sample expansion. The offline demo banks also include the new samples.

The interface uses CSS depth and hover effects, supports reduced motion,
and has no continuously rendering 3D scene. The exam provides a question
map and answer count; live MCQs still cannot be revisited.

Run `npm install` and `npm test` for the local browser and database checks.

### Add questions with Excel

Download [all five ready-made Excel templates](templates/hacknfix-excel-templates-v2.zip),
or get the template for one subject from its admin question bank.

In any subject’s admin **Questions** page, choose **Download Excel template**.
Fill the workbook’s **Questions** sheet, save as `.xlsx`, then choose
**Import Excel** in the same question bank. Review the preview and click
**Import questions**. The workbook includes separate instructions and examples.
The updated templates put **Correct answer** in column C, wrap long headings,
freeze the first two columns, and provide 25 formatted blank entry rows.
Dropdowns and cell guidance cover all 500 allowed rows. A **Field guide**
explains every required and optional column. Text formatting preserves leading
zeros and answers beginning with `=` when typed as text.
**Sort order** is optional in every bank; **Icon** is optional for quizzes.
Older v1 templates are still accepted. Download a fresh template to get the
new layout and Excel controls.
After editing `question-import.js`, `excel-export.js` or `subjects.js`, run
`npm run templates:build` to refresh the five committed templates and ZIP.

Templates cover Cyber Security Awareness, Video Editing, Graphic Design,
Basic Computer, and the Cyber Security Final Exam. Quiz templates accept
English, Bangla, or both; a missing language uses the other text without
translation. MCQs take 2–6 options and one correct answer (A–F). The final
exam template also accepts written and practical questions with model answers,
marks and hints. Set **Active** to **No** to import hidden drafts.

Imports accept up to 500 rows / 5 MB. Every error identifies its Excel row;
fix all errors before importing. Blank rows and identical duplicates are
skipped. A question with conflicting answers or settings must be edited in
the existing bank. All new rows are saved in one database request, and a
retry checks the bank again. This feature uses the existing database schema;
no new migration is required. The spreadsheet reader is bundled locally.

`tests/question-import-flow.test.cjs` exercises template download, Excel
resave, upload, preview, authenticated writes into a local Postgres database,
reload, duplicate detection and student quiz rendering for every subject.
It also covers final exam question types, invalid files and failed-save retry.
These tests do not write to the live Supabase project.

### Reliability update and 50-student QA

For an existing installation, run
[migrations/20261003-exam-recovery.sql](migrations/20261003-exam-recovery.sql)
in the **Supabase SQL Editor** before using the new exam recovery behavior.
This preserves student records and allows the same paper to resume after
registration closes or an initial start response is lost. New installations
can use the updated `supabase-schema.sql` directly.

API requests have a 15-second timeout. Quiz and admin loading failures
offer retry controls. Starting a configured quiz waits for its actual
questions and settings; an empty or failed bank cannot start demo questions.
The database client is bundled locally, and fonts load without blocking
the page. Rapid exam answer changes are coalesced, pending answers are
flushed before submission, and answer controls are locked while submitting.

See [QA_REPORT.md](QA_REPORT.md) for automated browser acceptance scenarios,
database checks and the successful 50-connection local load test. Live
capacity also depends on the Supabase project and students' network.

To repeat the load test, create a disposable **local**, empty UTF-8 PostgreSQL
database named `hacknfix_qa` and set `QA_POSTGRES_URL`, then run
`npm run test:load`. The script refuses remote or nonempty databases and
writes its report to `test-results/load-50.json`.

After editing `sample-questions.js`, run `npm run samples:build` to update
both SQL seed files.
After editing the starter questions in `subjects.js`, run
`npm run subjects:build` to update the subject seed in
`supabase-schema.sql`.
