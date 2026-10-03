# HacknFix — backend setup

Your quiz now has a real backend. Questions, participant results and site
settings all live in a Supabase (hosted Postgres) database, and you control
them from `admin.html`.

There is no server to run and nothing to deploy for the backend itself —
Supabase hosts the database and the API. These pages are still plain static
HTML that talk to it directly.

```
index.html           the quiz (now loads questions from the database)
admin.html           your admin panel  <-- dashboard, questions, results, feedback
config.js            your Supabase URL + anon key (you fill this in)
supabase-schema.sql  paste this into Supabase once, to create the database
```

---

## Step 1 — Create the Supabase project

1. Go to <https://supabase.com> and sign up (free tier is plenty).
2. **New project**. Give it a name, set a database password (save it
   somewhere), pick the region closest to you — Singapore or Mumbai are the
   nearest to Bangladesh.
3. Wait ~2 minutes while it provisions.

## Step 2 — Create the tables

1. In the left sidebar open **SQL Editor** → **New query**.
2. Open `supabase-schema.sql`, copy the **entire** file, paste it in, press
   **Run**.

You should see "Success". Check **Table Editor** — alongside the Cyber Security
quiz and exam tables, the new subject quizzes use `subject_questions`,
`subject_attempts`, `subject_settings`, `subject_visits` and `subject_feedback`.

This file is safe to run more than once. The seed at the bottom only fires
when the questions table is empty, so re-running it will never duplicate
your questions.

> **Already had this running before the dashboard existed?** Re-run the file.
> It adds the `visits` and `feedback` tables and leaves your existing
> questions, results and settings exactly as they are. Until you do, the
> Dashboard and Feedback tabs will tell you they are waiting for it.

> **Adding Video Editing, Graphic Design and Basic Computer to an existing
> project?** Run the latest full SQL file again. It creates their isolated
> tables and functions and adds starter questions without deleting existing
> Cyber Security questions or results. The new quizzes save shared results
> only after this migration is applied.

## Step 3 — Connect your pages to it

1. In Supabase, go to **Project Settings** → **API**.
2. Copy the **Project URL** and the **anon public** key.
3. Open `config.js` and paste them in:

```js
window.HACKNFIX_CONFIG = {
  SUPABASE_URL: "https://abcdefgh.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi..."
};
```

> The anon key is *meant* to be public — it ships inside your web page and
> anyone can read it. What protects your data is Row Level Security, which
> the SQL file already set up.
>
> **Never** put the `service_role` key in this file. That key ignores every
> security rule.

## Step 4 — Create your admin login

1. In Supabase go to **Authentication** → **Users** → **Add user** →
   *Create new user*.
2. Enter your email and a strong password. Tick **Auto Confirm User**.
3. Then go to **Authentication** → **Sign In / Providers** → **Email** and
   turn **Allow new users to sign up** *off*.

That last step matters: the security rules grant admin powers to anyone who
is logged in, so you don't want strangers creating their own accounts.

## Step 5 — Run it

With Python installed, `npm start` also serves the site at
<http://localhost:8000>. No frontend build is needed.

Open the folder in a terminal and start any static file server:

```bash
npx serve .
# or, if you prefer Python:
python -m http.server 8000
```

Then open:

- **http://localhost:3000** — the quiz
- **http://localhost:3000/admin.html** — the admin panel

(Port 8000 if you used Python.)

Don't just double-click the HTML files. Opening them as `file://` makes
browsers block parts of the setup; serve them over `http://` as above.

---

## Using the admin panel

After signing in, choose **Awareness Quiz** or **Final Exam**. Use
**Workspaces** to return to this choice. Quiz controls and final-exam
controls appear separately, and only the page you open loads its data.

**Final Exam dashboard** is the first page in the exam workspace. It uses
the existing exam tables and `exam_stats()` function; no additional SQL
migration is required for the dashboard.

- All-time student and paper totals, pending marking, flagged papers,
  average marked score, and automatic submissions.
- Current attempts and expired attempts that were never submitted, with
  saved-question counts, last save times, remaining time and paper review.
  A saved draft may be blank. These records do not prove a student is online.
- The oldest 10 papers waiting for marking, 10 recent submissions, and
  the latest 30 violation events with links to the associated papers.
- Activity over 7, 14 or 30 days and a score distribution of marked papers.
  Charts use up to 1,000 submissions in that period; the page labels a
  truncated sample. Global metric tiles are not limited by these lists.
- Question availability, timer settings and monitoring rules, plus quick
  controls for registration, marking queues, questions and exam settings.

The attempt monitor loads up to 100 records per status view, earliest
deadline first. Search and flag filters apply to those loaded records.
Closing registrations affects new starts; it does not force-submit active
papers. Papers still in progress can be reviewed but their grading controls
are disabled. Live refresh runs every 20 seconds and pauses when the tab is
hidden or you move to another admin page. Read failures are shown explicitly.

The Final Exam question bank includes a search field and **Add 32 sample
questions**: 20 MCQs, 8 written/CQ questions and 4 practical tasks. Importing
again skips samples already present. Students can try these immediately
from the public practice area, without a database update or registration.
Practice is local and does not submit scores or answers.

**Dashboard tab** — who is actually showing up.

- *The tiles* — unique visitors, page views, visitors today, quiz attempts,
  completion rate, average score, feedback count and average rating. These
  are counted across the whole database, not just the rows on screen.
- *Visitors and attempts* — a bar per day for the last 7, 14 or 30 days.
  Hover a day for exact numbers, or press **Table** to read the whole range
  as a table, including page views and how many started versus finished.
- *Where people drop off* — of everyone who opened the site, how many
  started the quiz and how many reached the result screen. This is usually
  the most useful chart on the page: a big gap between "opened" and
  "started" means the front page is losing people.
- *When people visit* — first visit by hour of day, in your timezone. Handy
  for deciding when to post the link.
- *Devices, browsers, where they came from, operating system* — add
  `?ref=something` to a link (`yoursite.com/?ref=poster-qr`,
  `?ref=fb-post`) and that tag shows up under "where they came from", so
  you can tell which poster or post actually worked.
- *LIVE* — the dashboard refreshes itself every 20 seconds. Press the pill
  to pause it. It stops on its own while the browser tab is in the
  background, so it won't chew through a phone battery during an event.

**Feedback tab** — everything visitors have written, newest first. Filter by
unread or by star rating, search the text, mark items read as you work
through them, delete spam, or **Export CSV**. The tab shows a red count of
unread items.

Visitors reach the form two ways: the speech-bubble button in the site
header, on every screen, and a row of stars on their result screen — tapping
a star opens the form with that rating already chosen, so leaving feedback is
one tap for someone in a hurry. A rating on its own is enough; a comment,
name and contact detail are all optional.

**Questions tab** — add, edit, hide, reorder and delete questions. Each one
has বাংলা and English text, 2–6 options with exactly one marked correct, and
an explanation in both languages. "Hide" takes a question out of the quiz
without deleting it — useful for drafting.

**Results tab** — every completed attempt, with name, phone, email, score and
time. Search across the list, delete individual rows, or hit **Export CSV**
to open the whole thing in Excel (বাংলা names come through correctly).
Use **Download all Excel** for a complete `.xlsx` workbook across every
database page, or the **Excel** button on a row for one attempt. The CSV
button exports the currently loaded and visible rows.

**Site settings tab**
- *Quiz is open* — turn it off to close the quiz. Visitors see your closed
  message and the server refuses to record new scores.
- *Show the leaderboard* — hide the leaderboard on the result screen.
- *Questions asked per attempt* — each visitor gets this many questions,
  chosen at random from the active ones. Set it to 10 with 30 questions
  loaded and everyone gets a different mix.
- *Welcome title / subtitle / closed message* — edit the front page copy in
  both languages without touching any code.

Changes apply the next time someone loads the quiz page.

---

## Part 2 — the final exam

The site now opens on a choice of two things:

- **Awareness quiz** — the original, open to everyone, unchanged.
- **Final exam** — a graded exam for cyber security / ethical hacking
  students, behind a registration form.

### Turning it on

1. Re-run `supabase-schema.sql` (SQL Editor → paste → Run). It adds the
   exam tables and leaves your quiz, results, settings and feedback
   exactly as they are.
2. In the admin panel, open **Exam settings** and tick **The exam is
   open**. Until you do, the Final Exam card shows as closed.

On a fresh database, the schema seeds 25 MCQs, 10 written/CQ questions
and 6 practical tasks, including the expanded public practice bank.
Replace public samples with your own material under **Exam questions**
before using them for a graded assessment.

### How a paper works

A student fills in **name, student ID, batch, email and phone** — all five
are required — ticks the rules box, and the paper starts. They get a random
draw from your active questions, in three sections:

- **MCQ** — one question at a time with a countdown, 30 seconds by default.
  When it runs out the paper moves on by itself and there is no going back.
  Marked automatically the moment the paper is submitted.
- **Written** — long answers, marked by you.
- **Practical** — the same, with a monospaced box for commands. Marked by you.

Answers save as they are typed. A student who is knocked offline, or who
closes the tab by accident, gets back into the same paper with the same
questions, the same answers and the original clock still running.

Resuming requires the secret token saved in the browser that started the
exam. Re-entering a student ID in another browser cannot retrieve that
student's paper. Clearing browser storage removes this recovery token.

### Updating an existing installation

Run the updated `supabase-schema.sql` in the Supabase SQL Editor before
using the updated exam page. The exam start function now accepts a resume
token; the old function signature is removed. Apply this between exam
sessions: browsers running the previous version did not save recovery
tokens. Existing questions and results are preserved.

The local public API key cannot install this database update. Until it is
applied, the updated exam registration will report a missing RPC signature.

### Running the regression checks

Run `npm install`, then `npm test`. The browser tests use installed Microsoft
Edge by default. Set `BROWSER_CHANNEL=chrome` to use installed Chrome instead.
They launch their own local server and simulate Supabase responses; the SQL
tests use a temporary PostgreSQL-compatible PGlite database. Tests do not
write to the hosted Supabase project.

### Anti-cheating — what actually works

Be clear-eyed about this, because it matters when you are deciding whether
to fail someone.

**The browser-side blocks are a deterrent, not a lock.** Blocked during the
exam: copy, cut and paste (as events, as Ctrl+C / Ctrl+X / Ctrl+V, and as
the older Ctrl+Insert / Shift+Insert pair), select-all outside the answer
box, right-click, drag, text selection anywhere but the answer box, F12,
Ctrl+Shift+I / J / C, Ctrl+U, Ctrl+P and Ctrl+S. A cancelled copy also has
the clipboard overwritten with an empty string, so nothing is left staged
from the attempt. The exam runs fullscreen, and leaving it is caught.

The student can still select and edit inside their own answer box — Ctrl+A
works there, because they need it to rewrite what they typed — but copying
text *out* of the page is blocked everywhere, that box included.

A student who knows their way around developer tools can defeat every one
of these. Anything running in a page the student controls can be turned off
by the student.

**These parts hold, because they are in the database:**

- Correct answers are never sent to the browser. There is nothing in the
  page to read, no matter what tools they open. This is the important one.
- The clock is the server's. Changing the device clock does nothing.
- Every paper carries a secret token. Knowing another student's attempt id
  gets you nothing — you cannot read their paper, write into it or submit it.
- One sitting per student ID, enforced on insert rather than in the page.
- Questions and options are shuffled per student, so two people side by side
  are not on the same question at the same time.
- **Every violation is logged with a server timestamp, whether or not the
  block itself worked.** This is what you actually mark on.

So a student who bypasses the copy block still leaves a trail. When you open
their paper you see the violation log: what they did, and when. Three
violations (configurable) submits the paper automatically and flags it.

### Leaving the exam ends it

Separate from the strike system, and **on by default**: if a student leaves
fullscreen or minimises the window, the paper is submitted there and then.
No warning, no strike. They are told this in the rules before they start,
and the reason is recorded against the paper.

The switch is **Leaving fullscreen or minimising ends the exam immediately**
under Exam settings.

**Think carefully before leaving this on for a phone-based exam.** The
browser cannot tell the difference between a student deliberately switching
away and an incoming call minimising the browser for them. With this on, a
phone call costs a student their paper. For a phone exam, turn it off: the
same events then cost a strike, so the student gets a warning and you still
get the full log to judge.

Note that losing focus *without* the window being hidden — clicking the
address bar, say — is always only a strike. It is far too twitchy to end a
paper over.

A fair warning about false positives generally: if your students sit the
exam on phones, raise the violation limit as well, or set everything to log
quietly and judge the log yourself.

### The admin tabs

**Exam questions** — the bank. Each question is MCQ, written or practical,
carries its own marks, and can be hidden without deleting. MCQs need exactly
one correct option. Written and practical questions take **marking notes**:
what a full-mark answer contains. Only you ever see those, and they sit
beside the student's answer while you mark, so you are not re-deciding the
standard on every paper. Exam questions are English only.
Once a question has appeared in a paper, hide it instead of deleting it.
The database preserves that paper's question text and marking notes even if
you later edit the question bank. Re-running the schema copies the current
question text into older papers; text changed before that migration cannot
be recovered automatically.

**Exam results** — every paper, with the MCQ section already marked. The tab
shows a red count of papers waiting on you. Open one to:

- read the violation log for that student,
- see every MCQ with their answer and the correct one side by side,
- mark each written and practical answer out of its marks, with optional
  feedback,
- press **Finish marking** once everything has a mark.

Search by name, student ID, batch or email; filter to just the flagged ones;
export the visible rows to CSV.
**Excel** on a row (or beside **Review** in Recent results)
opens on a **Full exam paper** sheet: student details followed by every question,
MCQ option, student answer, marks and feedback. Long answers continue across
readable rows. Four additional sheets provide the student result, question-level
answers, violation events and the grader's note. To export several students together, tick their
row checkboxes and click **Download selected full papers**. **Select shown
papers** follows the current search and filter. **Select all papers (all
pages)** selects the whole database, including papers beyond the 500 shown;
untick individual rows to exclude them. Selection persists through searches
and filters until you clear it or reload the page.

The combined Excel workbook includes student and attempt IDs on its answer,
violation and note sheets. Unfinished papers include answers saved so far.
Progress is shown while papers load; a failed request keeps the selection for
retry and does not download an incomplete workbook. **All results summary
Excel** exports only the summary scores for every paper. Workbooks are created
in your browser using admin-only data. The CSV button exports only the loaded,
visible papers. These export controls need no additional SQL migration.

To remove one result, use **Delete** on its Final Exam Results row or beside
**Review** and **Excel** in Recent results. The confirmation identifies the
student and attempt. Deletion permanently removes that attempt's paper,
answers, marks and violation log; the student profile and other attempts stay.
Deleting an active attempt ends it. Removing a student's only attempt can let
them take the exam again. Counts and export selections update after deletion.
This uses the existing admin permissions and needs no SQL migration.

**Exam settings** — how many questions of each type, seconds per MCQ, minutes
for the written and practical sections, the pass mark, the violation limit,
whether leaving the exam ends it, and every anti-cheat switch individually. It shows you the total time a paper
adds up to as you change the numbers, so a 20-question MCQ section does not
quietly become a four-hour exam. Settings apply to papers started after you
save; a paper already running keeps the rules it began under.

### A note on marks

The student sees their MCQ score straight away, and is told the rest is
awaiting marking. They are never shown which MCQs they got wrong — that
would hand the answer key to the next student to sit the paper.

---

## What the dashboard collects

One row per visitor, written when the page loads. Deliberately **no IP
address and no raw user-agent string**:

| Stored | Not stored |
|---|---|
| A random session id kept in that browser | IP address |
| mobile / tablet / desktop | Any name or contact detail |
| Browser and OS family (Chrome, Android…) | The full user-agent string |
| Referring site, or your own `?ref=` tag | Precise location |
| Language, screen size, timezone | Anything linking a visit to an attempt |

The session id is a random number generated in the visitor's browser. It
lets a returning visitor update their own row instead of creating a second
one; it identifies nobody. Visits and quiz results are separate tables with
no join between them, so the dashboard can tell you *191 people finished*
without being able to tell you *which visit was which person*.

Feedback is different: visitors may type a name and a phone or email if they
want a reply. That is only ever visible to you on the Feedback tab.

Visitors never write to these tables directly — they call `track_visit()`,
`mark_visit()` and `submit_feedback()`, which are the only doors open to the
anon key. Reading any of it requires being logged in.

---

## Putting it online

Any static host works, since there is no server of your own:

- **Netlify Drop** — drag the folder onto <https://app.netlify.com/drop>.
  Easiest option, live in about thirty seconds.
- **Vercel** or **Cloudflare Pages** — connect a repo, no build command,
  output directory is the project root.
- **GitHub Pages** — push the folder, enable Pages on the branch.

Your admin panel will then be at `https://your-site/admin.html`. It's
protected by the Supabase login, not by being secret.

---

## How it fits together

```
                 ┌──────────────┐
   visitor  ───▶ │  index.html  │ ──── reads questions + settings ───┐
                 └──────────────┘                                    │
                        │  track_visit() · mark_visit()              │
                        │  submit_attempt() · submit_feedback()      │
                        ▼                                            ▼
                 ┌─────────────────────────────────────────────────────┐
                 │                 Supabase (Postgres)                 │
                 │   questions · attempts · settings                   │
                 │   visits · feedback                                 │
                 │   Row Level Security decides who may read/write     │
                 └─────────────────────────────────────────────────────┘
                        ▲                                            ▲
                        │  full read/write, after login              │
                 ┌──────────────┐                                    │
   you      ───▶ │  admin.html  │ ───────────────────────────────────┘
                 └──────────────┘
```

Who can do what:

| | Visitor (anon key) | You (logged in) |
|---|---|---|
| Read active questions | yes | yes |
| Read hidden/draft questions | no | yes |
| Add / edit / delete questions | no | yes |
| Submit a quiz score | yes, via `submit_attempt()` | yes |
| Read names, phones, emails | **no** | yes |
| See the leaderboard | name + score only | everything |
| Change site settings | no | yes |
| Record a visit | yes, via `track_visit()` | yes |
| Leave feedback | yes, via `submit_feedback()` | yes |
| Read visits or feedback | **no** | yes |

Two details worth knowing:

- Visitors never insert into `attempts` directly. They call the
  `submit_attempt()` function, which checks the quiz is open and that the
  score is sane before writing the row. That's also why nobody can read
  other people's phone numbers.
- The leaderboard is its own function that returns name and score only —
  contact details are never sent to the browser.

## If the internet drops

When Supabase is configured, starting a quiz waits for its questions and
settings. A failed load shows a retry button. An empty bank shows that no
questions are available. Requests time out after 15 seconds so controls
can recover. Demo questions are available when the connection is not configured.

Exam answers save as you work. Submission waits for pending saves and offers
retry when the connection fails. Use the same browser and student ID to resume
a paper after a refresh; the recovery token stays in that browser's storage.

For an existing installation, run
[migrations/20261003-exam-recovery.sql](migrations/20261003-exam-recovery.sql)
in the Supabase SQL Editor. It preserves existing data and enables recovery
from a lost initial start response and resuming after registration closes.
Updating files on GitHub alone does not apply this database migration.

## Things to know

**Answers are checked in the browser.** Someone who opens developer tools
could read which option is correct. For an awareness quiz that's fine. If you
ever need it to be cheat-proof — a competition with prizes, say — the fix is
to stop sending the `correct` flags to the browser and grade inside a
database function instead. Ask and I'll wire that up.

**Hosting capacity.** The local PostgreSQL load test completed 50 concurrent
exam sessions successfully. Check your Supabase project's current resource
limits and status before an event, and verify access from the venue network.
The local result does not measure the live hosting plan or internet latency.
See [QA_REPORT.md](QA_REPORT.md) for the tested scope.

**Adding a question in bulk.** If you'd rather paste many questions at once
than use the form, the `questions` table takes plain SQL inserts — copy the
shape from the seed block at the bottom of `supabase-schema.sql`.
