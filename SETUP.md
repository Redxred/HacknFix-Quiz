# HacknFix — backend setup

Your quiz now has a real backend. Questions, participant results and site
settings all live in a Supabase (hosted Postgres) database, and you control
them from `admin.html`.

There is no server to run and nothing to deploy for the backend itself —
Supabase hosts the database and the API. These pages are still plain static
HTML that talk to it directly.

```
index.html           the quiz (now loads questions from the database)
admin.html           your admin panel  <-- this is where you change questions
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
3. You should see "Success". Check **Table Editor** — you now have
   `questions` (with your original 10 questions already in it), `attempts`,
   and `settings`.

This file is safe to run more than once. The seed at the bottom only fires
when the questions table is empty, so re-running it will never duplicate
your questions.

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

1. In Supabase go to **w* → **Users** → **Add user** →
   *Create new user*.
2. Enter your email and a strong password. Tick **Auto Confirm User**.
3. Then go to **Authentication** → **Sign In / Providers** → **Email** and
   turn **Allow new users to sign up** *off*.

That last step matters: the security rules grant admin powers to anyone who
is logged in, so you don't want strangers creating their own accounts.

## Step 5 — Run it

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

**Questions tab** — add, edit, hide, reorder and delete questions. Each one
has বাংলা and English text, 2–6 options with exactly one marked correct, and
an explanation in both languages. "Hide" takes a question out of the quiz
without deleting it — useful for drafting.

**Results tab** — every completed attempt, with name, phone, email, score and
time. Search across the list, delete individual rows, or hit **Export CSV**
to open the whole thing in Excel (বাংলা names come through correctly).

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
                        │  submit_attempt()                          │
                        ▼                                            ▼
                 ┌─────────────────────────────────────────────────────┐
                 │                 Supabase (Postgres)                 │
                 │   questions  ·  attempts  ·  settings                │
                 │   Row Level Security decides who may read/write      │
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

Two details worth knowing:

- Visitors never insert into `attempts` directly. They call the
  `submit_attempt()` function, which checks the quiz is open and that the
  score is sane before writing the row. That's also why nobody can read
  other people's phone numbers.
- The leaderboard is its own function that returns name and score only —
  contact details are never sent to the browser.

## If the internet drops

`index.html` still contains a copy of the original 10 questions. If Supabase
can't be reached, the quiz falls back to them, saves the score locally, and
shows a note explaining what happened. Your event doesn't die because the
venue wifi did.

## Things to know

**Answers are checked in the browser.** Someone who opens developer tools
could read which option is correct. For an awareness quiz that's fine. If you
ever need it to be cheat-proof — a competition with prizes, say — the fix is
to stop sending the `correct` flags to the browser and grade inside a
database function instead. Ask and I'll wire that up.

**Free tier limits.** Plenty for an event: 500MB database, 50,000 monthly
active users. Supabase pauses projects after a week of no activity — just
open the dashboard to wake it up. Do that the day before you demo, not the
morning of.

**Adding a question in bulk.** If you'd rather paste many questions at once
than use the form, the `questions` table takes plain SQL inserts — copy the
shape from the seed block at the bottom of `supabase-schema.sql`.
