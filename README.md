# HacknFix

A bilingual (বাংলা / English) cyber-awareness quiz for everyday Bangladeshi
internet users — Facebook, IMO, bKash, bank apps and public wifi scams.

Ten scenario questions, an explanation after every answer, and a shared
leaderboard.

## Stack

Plain HTML/CSS/JS on the front, [Supabase](https://supabase.com) (hosted
Postgres) on the back. No build step and no server to run.

| File | Purpose |
|---|---|
| `index.html` | the quiz |
| `admin.html` | admin panel — questions, results, settings |
| `config.js` | Supabase project URL + publishable key |
| `supabase-schema.sql` | run once to create the database |
| `SETUP.md` | full setup walkthrough |

## Running it

```bash
python -m http.server 8000
# or: npx serve .
```

Quiz at `localhost:8000`, admin panel at `localhost:8000/admin.html`.

See [SETUP.md](SETUP.md) to connect your own Supabase project.

## A note on the key in `config.js`

That is the **publishable / anon** key. It is designed to be public — it
ships inside the page to every visitor either way. What protects the data is
Row Level Security, defined in `supabase-schema.sql`:

- visitors can read active questions, but cannot add or edit any
- visitors can submit a score, but cannot read anyone's name, phone or email
- the public leaderboard returns name and score only
- everything else requires an admin login

Secret keys (`sb_secret_…` / `service_role`) must never go in this repo.
