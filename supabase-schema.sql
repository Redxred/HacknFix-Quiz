-- ============================================================
--  HacknFix - Supabase schema
--  Paste this whole file into:
--     Supabase Dashboard > SQL Editor > New query > Run
--  Safe to re-run: policies/functions are dropped and recreated,
--  and the seed at the bottom only fires when the table is empty.
-- ============================================================

-- gen_random_uuid() is built into Postgres core (13+), so no extension
-- is needed here.

-- ------------------------------------------------------------
-- 1. TABLES
-- ------------------------------------------------------------

-- Quiz questions. Bilingual (bn/en). Options live in a jsonb array
-- shaped exactly like the frontend expects:
--   [{"bn":"...","en":"...","correct":true}, ...]
create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  sort_order  int         not null default 0,
  icon        text        not null default 'alert',
  q_bn        text        not null,
  q_en        text        not null,
  options     jsonb       not null,
  explain_bn  text        not null default '',
  explain_en  text        not null default '',
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One row per completed quiz. Contains PII (phone/email), so it is
-- never readable by the public - see the RLS policies below.
create table if not exists public.attempts (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null default 'Guest',
  phone      text,
  email      text,
  score      int         not null,
  total      int         not null,
  lang       text        not null default 'bn',
  created_at timestamptz not null default now()
);

create index if not exists attempts_score_idx  on public.attempts (score desc, created_at asc);
create index if not exists questions_order_idx on public.questions (sort_order asc);

-- Site-wide settings. Exactly one row, id = 1.
create table if not exists public.settings (
  id               int     primary key default 1 check (id = 1),
  quiz_open        boolean not null default true,
  quiz_length      int     not null default 10,
  show_leaderboard boolean not null default true,
  welcome_title_bn text    not null default 'আপনি কতটা সাইবার সচেতন?',
  welcome_title_en text    not null default 'How cyber aware are you?',
  welcome_sub_bn   text    not null default 'ফেসবুক, আইএমও, বিকাশ আর ব্যাংক অ্যাপ ব্যবহার করেন? দেখুন প্রতারণা থেকে নিজেকে বাঁচাতে আপনি কতটা প্রস্তুত।',
  welcome_sub_en   text    not null default 'You use Facebook, IMO, bKash and bank apps every day. See how ready you are to spot a scam.',
  closed_msg_bn    text    not null default 'কুইজটি এই মুহূর্তে বন্ধ আছে। পরে আবার চেষ্টা করুন।',
  closed_msg_en    text    not null default 'The quiz is closed right now. Please check back later.',
  updated_at       timestamptz not null default now()
);

insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 1b. UPGRADES
--     These bring an already-created database up to date. They are
--     no-ops on a fresh install, and safe to run again any time.
-- ------------------------------------------------------------

-- Countdown per question, in seconds. 0 turns the timer off entirely.
alter table public.settings
  add column if not exists timer_seconds int not null default 0;

-- How long the whole attempt took, in seconds.
alter table public.attempts
  add column if not exists duration_seconds int;

-- ------------------------------------------------------------
-- 2. ROW LEVEL SECURITY
--    The anon key is public - anyone can read it out of your HTML.
--    These policies are what actually keep the data safe.
-- ------------------------------------------------------------

alter table public.questions enable row level security;
alter table public.attempts  enable row level security;
alter table public.settings  enable row level security;

drop policy if exists "questions_public_read" on public.questions;
drop policy if exists "questions_admin_all"   on public.questions;
drop policy if exists "attempts_admin_read"   on public.attempts;
drop policy if exists "attempts_admin_write"  on public.attempts;
drop policy if exists "settings_public_read"  on public.settings;
drop policy if exists "settings_admin_write"  on public.settings;

-- Visitors may read ACTIVE questions only.
create policy "questions_public_read" on public.questions
  for select to anon
  using (is_active);

-- Logged-in admins may read/write everything, including drafts.
create policy "questions_admin_all" on public.questions
  for all to authenticated
  using (true) with check (true);

-- Nobody can read attempts except a logged-in admin. Visitors submit
-- through submit_attempt() below rather than inserting directly, so
-- there is deliberately no anon insert policy here.
create policy "attempts_admin_read" on public.attempts
  for select to authenticated using (true);

create policy "attempts_admin_write" on public.attempts
  for all to authenticated
  using (true) with check (true);

-- Everyone can read settings (the quiz needs them in order to render).
create policy "settings_public_read" on public.settings
  for select to anon, authenticated using (true);

create policy "settings_admin_write" on public.settings
  for update to authenticated
  using (true) with check (true);

-- ------------------------------------------------------------
-- 3. FUNCTIONS THE PUBLIC SITE CALLS
--    security definer = runs with the owner's rights, so it can reach
--    past RLS - but only to do the one narrow thing it is written to do.
-- ------------------------------------------------------------

-- Save a finished quiz. Returns the new row id so the browser can
-- highlight "you" on the leaderboard without ever reading the table.
--
-- The older 6-argument version is dropped first: adding a parameter
-- would otherwise leave two overloads behind and make the call ambiguous.
drop function if exists public.submit_attempt(text, text, text, int, int, text);

create or replace function public.submit_attempt(
  p_name     text,
  p_phone    text,
  p_email    text,
  p_score    int,
  p_total    int,
  p_lang     text,
  p_duration int default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id   uuid;
  v_open boolean;
begin
  select quiz_open into v_open from public.settings where id = 1;
  if not coalesce(v_open, true) then
    raise exception 'quiz_closed';
  end if;

  if p_total <= 0 or p_total > 100 or p_score < 0 or p_score > p_total then
    raise exception 'invalid_score';
  end if;

  insert into public.attempts (name, phone, email, score, total, lang, duration_seconds)
  values (
    left(coalesce(nullif(trim(p_name), ''), 'Guest'), 60),
    left(nullif(trim(p_phone), ''), 20),
    left(nullif(trim(p_email), ''), 120),
    p_score,
    p_total,
    case when p_lang in ('bn', 'en') then p_lang else 'bn' end,
    -- ignore nonsense durations rather than storing them
    case when p_duration between 0 and 86400 then p_duration else null end
  )
  returning id into v_id;

  return v_id;
end
$fn$;

-- Public leaderboard. Deliberately returns no phone and no email.
create or replace function public.leaderboard(p_limit int default 10)
returns table (id uuid, name text, score int, total int, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $fn$
  select a.id, a.name, a.score, a.total, a.created_at
  from public.attempts a
  order by a.score desc, a.created_at asc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$fn$;

-- Aggregate counters for the landing page. Counts only - no rows, no names,
-- so this is safe to expose to everyone.
create or replace function public.quiz_stats()
returns table (total_attempts bigint, avg_percent int, best_score int)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    count(*)::bigint,
    coalesce(round(avg(case when a.total > 0
                            then a.score::numeric / a.total * 100
                            else 0 end))::int, 0),
    coalesce(max(a.score), 0)
  from public.attempts a;
$fn$;

revoke all on function public.submit_attempt(text, text, text, int, int, text, int) from public;
revoke all on function public.leaderboard(int) from public;
revoke all on function public.quiz_stats() from public;
grant execute on function public.submit_attempt(text, text, text, int, int, text, int) to anon, authenticated;
grant execute on function public.leaderboard(int) to anon, authenticated;
grant execute on function public.quiz_stats() to anon, authenticated;

-- ------------------------------------------------------------
-- 4. SEED - your original 10 questions.
--    Only runs when the table is empty, so re-running this file
--    will never duplicate them.
-- ------------------------------------------------------------

do $seed$
begin
if not exists (select 1 from public.questions) then

insert into public.questions (sort_order, icon, q_bn, q_en, options, explain_bn, explain_en) values
  (1, 'social', 'আপনি চেনেন না এমন একজন ফেসবুকে ফ্রেন্ড রিকোয়েস্ট পাঠিয়ে সাথে সাথে আপনার এনআইডি নম্বর ও ঠিকানা চাইছে। আপনি কী করবেন?', 'A stranger sends you a Facebook friend request and immediately asks for your NID number and address. What should you do?', '[{"bn":"তথ্য দিয়ে দিন, সে বন্ধুত্বপূর্ণ মনে হচ্ছে","en":"Share the info, they seem friendly","correct":false},{"bn":"অচেনা মানুষের সাথে ব্যক্তিগত তথ্য শেয়ার করবেন না","en":"Don''t share personal details with strangers","correct":true},{"bn":"আগে ফ্রেন্ড রিকোয়েস্ট গ্রহণ করুন, পরে ভাবা যাবে","en":"Accept the request first, decide later","correct":false}]'::jsonb, 'সত্যিকারের বন্ধুরা প্রথমেই এনআইডি বা ঠিকানা চায় না। অচেনা মানুষকে ব্যক্তিগত তথ্য দেওয়া থেকে বিরত থাকুন।', 'Real friends don''t ask for your NID or address right away. Never share personal details with strangers online.'),
  (2, 'gift', 'ফেসবুকে একটা মেসেজ আসলো, ''অভিনন্দন! আপনি একটি ফ্রি স্মার্টফোন জিতেছেন, লিংকে ক্লিক করুন।'' আপনি কী করবেন?', 'You get a Facebook message: ''Congratulations! You won a free smartphone, click this link to claim it.'' What do you do?', '[{"bn":"অফার শেষ হওয়ার আগে দ্রুত ক্লিক করুন","en":"Click quickly before the offer expires","correct":false},{"bn":"ক্লিক করবেন না — এটি একটি সাধারণ প্রতারণার কৌশল","en":"Don''t click — this is a common scam trick","correct":true},{"bn":"বন্ধুকে দিয়ে ক্লিক করাবেন","en":"Ask a friend to click it for you","correct":false}]'::jsonb, 'এ ধরনের ''ফ্রি গিফট'' লিংক আসলে আপনার তথ্য বা টাকা চুরি করার ফাঁদ। কখনো বিশ্বাস করবেন না।', 'These ''free gift'' links are traps designed to steal your information or money. Never trust them.'),
  (3, 'call', 'কেউ আইএমও-তে কল করে বলছে সে ব্যাংক থেকে বলছে, এবং আপনাকে সদ্য পাওয়া ওটিপি কোডটি বলতে বলছে। আপনি কী করবেন?', 'Someone calls you on IMO, claims to be from your bank, and asks you to read out the OTP code you just received. What should you do?', '[{"bn":"অ্যাকাউন্ট যাচাইয়ের জন্য ওটিপি বলে দিন","en":"Tell them the OTP to verify your account","correct":false},{"bn":"কাউকে কখনো ওটিপি শেয়ার করবেন না — কল কেটে দিন","en":"Never share your OTP with anyone — hang up","correct":true},{"bn":"শুধু শেষ ২ সংখ্যা বলুন","en":"Share only the last 2 digits","correct":false}]'::jsonb, 'প্রকৃত ব্যাংক কখনো ফোনে ওটিপি চায় না। ওটিপি শেয়ার করলে আপনার অ্যাকাউন্ট থেকে টাকা চুরি হতে পারে।', 'Real banks never ask for your OTP over the phone. Sharing it can let someone steal money from your account.'),
  (4, 'key', 'একজন কল করে বলছে, ''আমি বিকাশ এজেন্ট, আপনার অ্যাকাউন্টে সমস্যা হয়েছে, ঠিক করতে আপনার পিন নম্বর দিন।'' আপনি কী করবেন?', 'A caller says: ''I''m a bKash agent, there''s a problem with your account, send me your PIN to fix it.'' What do you do?', '[{"bn":"সমস্যা ঠিক করতে দ্রুত পিন দিয়ে দিন","en":"Send the PIN quickly to fix the issue","correct":false},{"bn":"কাউকে কখনো বিকাশ পিন শেয়ার করবেন না — এজেন্ট কখনো পিন চায় না","en":"Never share your bKash PIN — agents never ask for it","correct":true},{"bn":"পিনের অর্ধেক বলুন","en":"Share half the PIN","correct":false}]'::jsonb, 'বিকাশ, নগদ বা কোনো মোবাইল ব্যাংকিং প্রতিষ্ঠান কখনো আপনার পিন চায় না। পিন চাওয়া মানেই প্রতারণা।', 'bKash, Nagad, or any mobile banking service never asks for your PIN. Anyone asking for it is a scammer.'),
  (5, 'link', 'একটা এসএমএস আসলো: ''আপনার ব্যাংক অ্যাকাউন্ট লক হয়ে গেছে, আনলক করতে লিংকে ক্লিক করুন।'' লিংকটা দেখতে ব্যাংকের আসল ওয়েবসাইটের মতো হলেও একটু আলাদা। আপনি কী করবেন?', 'You get an SMS: ''Your bank account is locked, click this link to unlock it.'' The link looks a bit different from your bank''s real site. What do you do?', '[{"bn":"অ্যাকাউন্ট আনলক করতে সাথে সাথে ক্লিক করুন","en":"Click immediately to unlock your account","correct":false},{"bn":"ক্লিক করবেন না — সরাসরি ব্যাংক অ্যাপ খুলুন বা অফিসিয়াল নম্বরে কল করুন","en":"Don''t click — open your bank app directly or call the official number","correct":true},{"bn":"এসএমএস-এর উত্তরে আরও বিস্তারিত জানতে চান","en":"Reply to the SMS asking for more details","correct":false}]'::jsonb, 'প্রতারকরা ব্যাংকের মতো দেখতে ভুয়া লিংক পাঠায়। সন্দেহ হলে লিংকে ক্লিক না করে সরাসরি ব্যাংকে যোগাযোগ করুন।', 'Scammers send fake links that look like your bank''s. If in doubt, don''t click — contact the bank directly instead.'),
  (6, 'wifi', 'আপনি একটি দোকানে আছেন যেখানে ফ্রি পাবলিক ওয়াইফাই আছে। এই ওয়াইফাই দিয়ে কি বিকাশ বা ব্যাংক অ্যাপে লগইন করা উচিত?', 'You''re at a shop with free public wifi. Should you log into your bKash or bank app while connected to it?', '[{"bn":"হ্যাঁ, ওয়াইফাইতে পাসওয়ার্ড থাকলে সমস্যা নেই","en":"Yes, it''s fine if the wifi has a password","correct":false},{"bn":"পাবলিক ওয়াইফাইতে ব্যাংকিং অ্যাপে লগইন এড়িয়ে চলুন — মোবাইল ডেটা ব্যবহার করুন","en":"Avoid logging into banking apps on public wifi — use mobile data instead","correct":true},{"bn":"কয়েক সেকেন্ডের জন্য লগইন করলে সমস্যা নেই","en":"It''s fine if you only log in for a few seconds","correct":false}]'::jsonb, 'পাবলিক ওয়াইফাইতে অন্যরা আপনার তথ্য দেখতে পারে। টাকা-পয়সার অ্যাপে লগইনের সময় মোবাইল ডেটা ব্যবহার করা নিরাপদ।', 'On public wifi, others can potentially see your data. Use mobile data instead when logging into money apps.'),
  (7, 'lock', 'ফেসবুক আর বিকাশ অ্যাকাউন্টে একই পাসওয়ার্ড ব্যবহার করা কি নিরাপদ?', 'Is it safe to use the same password for your Facebook and bKash accounts?', '[{"bn":"হ্যাঁ, মনে রাখা সহজ হয়","en":"Yes, it''s easier to remember","correct":false},{"bn":"না — আলাদা পাসওয়ার্ড ব্যবহার করুন, একটা হ্যাক হলে আরেকটা নিরাপদ থাকবে","en":"No — use different passwords, so one hack doesn''t risk everything","correct":true},{"bn":"পাসওয়ার্ড লম্বা হলে সমস্যা নেই","en":"It''s fine as long as the password is long","correct":false}]'::jsonb, 'একই পাসওয়ার্ড সব জায়গায় ব্যবহার করলে একটা অ্যাকাউন্ট হ্যাক হলে বাকি সব অ্যাকাউন্টও বিপদে পড়ে।', 'Reusing one password everywhere means one hacked account can put all your other accounts at risk too.'),
  (8, 'phone', 'একজন পরিচিত মানুষ আপনার ফোন ''একটু কল করার জন্য'' চাইছে। আপনার বিকাশ অ্যাপ তখন খোলা এবং লগইন করা আছে। নিরাপদ উপায় কোনটি?', 'An acquaintance asks to borrow your phone for a ''quick call.'' Your bKash app is already open and logged in. What''s the safer move?', '[{"bn":"ফোন দিয়ে দিন, শুধু একটা কল তো","en":"Hand it over, it''s just a quick call","correct":false},{"bn":"আগে বিকাশ অ্যাপটি বন্ধ/লক করুন, খোলা অ্যাপসহ ফোন কাউকে দেবেন না","en":"Close/lock the bKash app first — don''t hand over a phone with open apps","correct":true},{"bn":"আপনি পাশে থাকলে সমস্যা নেই","en":"It''s fine as long as you''re watching","correct":false}]'::jsonb, 'খোলা থাকা অ্যাপ দিয়ে কেউ দ্রুত টাকা পাঠিয়ে দিতে পারে। ফোন দেওয়ার আগে সংবেদনশীল অ্যাপ বন্ধ করে নেওয়া ভালো।', 'An open app can let someone quickly send money without you noticing. Always close sensitive apps before handing over your phone.'),
  (9, 'job', 'একটা মেসেজ আসলো: ''চাকরি আছে, বেতন ২৫,০০০ টাকা, শুধু ৫০০ টাকা রেজিস্ট্রেশন ফি আর এনআইডি কপি পাঠান।'' আপনি কী করবেন?', 'You get a message: ''Job available, salary 25,000 taka, just send a 500 taka registration fee and your NID copy first.'' What should you do?', '[{"bn":"চাকরি পাকা করতে টাকা আর এনআইডি পাঠিয়ে দিন","en":"Send the money and NID to secure the job","correct":false},{"bn":"সন্দেহ করুন — প্রকৃত চাকরিতে আগে থেকে টাকা চাওয়া হয় না","en":"Be suspicious — real jobs don''t ask for money upfront","correct":true},{"bn":"শুধু এনআইডি কপি পাঠান, টাকা না","en":"Send only the NID copy, not money","correct":false}]'::jsonb, 'আগে থেকে টাকা বা ব্যক্তিগত ডকুমেন্ট চাওয়া চাকরির বিজ্ঞাপন প্রায়ই প্রতারণা। প্রতিষ্ঠান ভালোভাবে যাচাই না করে কিছু পাঠাবেন না।', 'Job offers that ask for money or personal documents upfront are usually scams. Verify the company before sending anything.'),
  (10, 'alert', 'আপনার আত্মীয় ফেসবুকে মেসেজ দিলো: ''আমি বিপদে আছি, এখনই এই বিকাশ নম্বরে ২০০০ টাকা পাঠাও।'' মেসেজটা জরুরি আর কিছুটা অস্বাভাবিক লাগছে। সবচেয়ে নিরাপদ উপায় কী?', 'A relative messages you on Facebook: ''I''m in trouble, send 2000 taka to this bKash number right now.'' It feels urgent and a bit unusual. What''s the safest move?', '[{"bn":"সাথে সাথে টাকা পাঠিয়ে দিন, আত্মীয় তো","en":"Send the money immediately, it''s family","correct":false},{"bn":"টাকা পাঠানোর আগে তার ফোন নম্বরে সরাসরি কল বা মেসেজ করে নিশ্চিত হন","en":"Call or message their actual phone number directly to confirm first","correct":true},{"bn":"নিশ্চিত না হয়ে অর্ধেক টাকা পাঠান","en":"Send half the amount just in case","correct":false}]'::jsonb, 'ফেসবুক অ্যাকাউন্ট হ্যাক হয়ে এভাবে টাকা চাওয়া একটি খুবই পরিচিত প্রতারণা। টাকা পাঠানোর আগে সবসময় সরাসরি ফোনে নিশ্চিত হন।', 'Hacked Facebook accounts asking for urgent money is a very common scam. Always confirm by calling directly before sending money.');

end if;
end
$seed$;

-- ============================================================
--  5. ANALYTICS + FEEDBACK
--     Added for the admin dashboard. Everything below is
--     create-if-not-exists / create-or-replace, so re-running
--     this whole file on an existing project is safe.
-- ============================================================

-- One row per visitor session, not per page load. The browser keeps a
-- random session id in localStorage and calls track_visit() with it, so a
-- returning visitor updates their row instead of adding another.
--
-- Deliberately no IP address and no full user-agent string: the dashboard
-- only needs shapes (phone vs desktop, Chrome vs Safari), not identities.
create table if not exists public.visits (
  id            uuid        primary key default gen_random_uuid(),
  session_id    text        not null unique,
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  page_views    int         not null default 1,
  device        text        not null default 'unknown',   -- mobile / tablet / desktop
  browser       text        not null default 'unknown',
  os            text        not null default 'unknown',
  referrer      text        not null default 'direct',    -- host only, never the full URL
  lang          text        not null default 'bn',
  screen        text,                                     -- "390x844"
  timezone      text,
  started_quiz  boolean     not null default false,
  finished_quiz boolean     not null default false,
  gave_feedback boolean     not null default false
);

create index if not exists visits_first_seen_idx on public.visits (first_seen desc);
create index if not exists visits_last_seen_idx  on public.visits (last_seen desc);

-- Visitor feedback. Rating is 1-5 stars; either a rating or a message is
-- enough to submit, both are better.
create table if not exists public.feedback (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null default 'Guest',
  contact    text,                                        -- phone or email, optional
  rating     int         not null default 0,
  message    text        not null default '',
  lang       text        not null default 'bn',
  session_id text,
  is_read    boolean     not null default false,
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_idx on public.feedback (created_at desc);

-- ------------------------------------------------------------
-- 5b. ROW LEVEL SECURITY - same shape as the rest of the file.
--     Visitors never touch these tables directly; they go through the
--     security-definer functions below. So there is no anon policy here.
-- ------------------------------------------------------------

alter table public.visits   enable row level security;
alter table public.feedback enable row level security;

drop policy if exists "visits_admin_all"   on public.visits;
drop policy if exists "feedback_admin_all" on public.feedback;

create policy "visits_admin_all" on public.visits
  for all to authenticated
  using (true) with check (true);

create policy "feedback_admin_all" on public.feedback
  for all to authenticated
  using (true) with check (true);

-- Belt and braces. Row Level Security already stops the anon key reading
-- these, but taking the table privilege away too means a future policy
-- written by mistake cannot open them up by accident. Visitors reach both
-- tables only through the security-definer functions below.
revoke all on public.visits   from anon;
revoke all on public.feedback from anon;
grant select, insert, update, delete on public.visits   to authenticated;
grant select, insert, update, delete on public.feedback to authenticated;

-- ------------------------------------------------------------
-- 5c. WHAT THE PUBLIC SITE CALLS
-- ------------------------------------------------------------

-- Record a visit. Called once per page load. The first call for a session
-- creates the row; later calls just bump page_views and last_seen.
create or replace function public.track_visit(
  p_session  text,
  p_device   text default 'unknown',
  p_browser  text default 'unknown',
  p_os       text default 'unknown',
  p_referrer text default 'direct',
  p_lang     text default 'bn',
  p_screen   text default null,
  p_timezone text default null
) returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- A missing or silly session id is ignored rather than stored: it would
  -- only ever become a junk row nobody can interpret.
  if p_session is null or length(trim(p_session)) < 8 or length(p_session) > 64 then
    return;
  end if;

  insert into public.visits (session_id, device, browser, os, referrer, lang, screen, timezone)
  values (
    trim(p_session),
    left(coalesce(nullif(trim(p_device),  ''), 'unknown'), 20),
    left(coalesce(nullif(trim(p_browser), ''), 'unknown'), 30),
    left(coalesce(nullif(trim(p_os),      ''), 'unknown'), 30),
    left(coalesce(nullif(trim(p_referrer),''), 'direct'),  120),
    case when p_lang in ('bn','en') then p_lang else 'bn' end,
    left(nullif(trim(p_screen),   ''), 20),
    left(nullif(trim(p_timezone), ''), 60)
  )
  on conflict (session_id) do update set
    last_seen  = now(),
    page_views = visits.page_views + 1,
    lang       = excluded.lang,
    -- keep whatever we learned first, but fill in blanks on a later visit
    device     = case when visits.device  = 'unknown' then excluded.device  else visits.device  end,
    browser    = case when visits.browser = 'unknown' then excluded.browser else visits.browser end,
    os         = case when visits.os      = 'unknown' then excluded.os      else visits.os      end;
end
$fn$;

-- Flag something the visitor did: started the quiz, finished it, or left
-- feedback. Flags only ever turn on, so a retake cannot un-finish a session.
create or replace function public.mark_visit(p_session text, p_event text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if p_session is null or p_event not in ('start','finish','feedback') then
    return;
  end if;

  update public.visits set
    last_seen     = now(),
    started_quiz  = started_quiz  or p_event = 'start',
    finished_quiz = finished_quiz or p_event = 'finish',
    gave_feedback = gave_feedback or p_event = 'feedback'
  where session_id = trim(p_session);
end
$fn$;

-- Save a piece of feedback. Returns the new row id.
create or replace function public.submit_feedback(
  p_name    text,
  p_contact text,
  p_rating  int,
  p_message text,
  p_lang    text default 'bn',
  p_session text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id  uuid;
  v_msg text := left(coalesce(trim(p_message), ''), 2000);
  v_rat int  := coalesce(p_rating, 0);
begin
  if v_rat < 0 or v_rat > 5 then
    raise exception 'invalid_rating';
  end if;

  -- Something has to be said. An empty form is not feedback.
  if v_rat = 0 and v_msg = '' then
    raise exception 'empty_feedback';
  end if;

  insert into public.feedback (name, contact, rating, message, lang, session_id)
  values (
    left(coalesce(nullif(trim(p_name), ''), 'Guest'), 60),
    left(nullif(trim(p_contact), ''), 120),
    v_rat,
    v_msg,
    case when p_lang in ('bn','en') then p_lang else 'bn' end,
    left(nullif(trim(p_session), ''), 64)
  )
  returning id into v_id;

  perform public.mark_visit(p_session, 'feedback');
  return v_id;
end
$fn$;

-- ------------------------------------------------------------
-- 5d. WHAT THE DASHBOARD CALLS
--     No security definer here on purpose - these run as the caller, so
--     RLS applies and only a logged-in admin gets anything back.
--     p_tz decides where a "day" starts; the database itself is UTC.
-- ------------------------------------------------------------

create or replace function public.analytics_daily(
  p_days int  default 14,
  p_tz   text default 'Asia/Dhaka'
)
returns table (
  day        date,
  visitors   bigint,
  page_views bigint,
  started    bigint,
  finished   bigint,
  attempts   bigint,
  feedbacks  bigint
)
language sql
stable
as $fn$
  with bounds as (
    select greatest(1, least(coalesce(p_days, 14), 90)) as n,
           coalesce(nullif(trim(p_tz), ''), 'UTC')      as tz
  ),
  days as (
    select generate_series(
             (timezone(b.tz, now())::date - (b.n - 1)),
             timezone(b.tz, now())::date,
             interval '1 day'
           )::date as day
    from bounds b
  ),
  v as (
    select timezone(b.tz, vi.first_seen)::date               as day,
           count(*)                                          as visitors,
           sum(vi.page_views)                                as page_views,
           count(*) filter (where vi.started_quiz)           as started,
           count(*) filter (where vi.finished_quiz)          as finished
    from public.visits vi cross join bounds b
    group by 1
  ),
  tries as (
    select timezone(b.tz, a.created_at)::date as day, count(*) as attempts
    from public.attempts a cross join bounds b
    group by 1
  ),
  fb as (
    select timezone(b.tz, f.created_at)::date as day, count(*) as feedbacks
    from public.feedback f cross join bounds b
    group by 1
  )
  select d.day,
         coalesce(v.visitors,  0)::bigint,
         coalesce(v.page_views,0)::bigint,
         coalesce(v.started,   0)::bigint,
         coalesce(v.finished,  0)::bigint,
         coalesce(tries.attempts, 0)::bigint,
         coalesce(fb.feedbacks,0)::bigint
  from days d
  left join v  on v.day  = d.day
  left join tries on tries.day = d.day
  left join fb on fb.day = d.day
  order by d.day;
$fn$;

-- The headline numbers, counted across the whole table rather than across
-- the rows the browser happens to have downloaded.
create or replace function public.analytics_totals(p_tz text default 'Asia/Dhaka')
returns table (
  visitors        bigint,
  page_views      bigint,
  started         bigint,
  finished        bigint,
  visitors_today  bigint,
  attempts        bigint,
  attempts_today  bigint,
  feedbacks       bigint,
  unread_feedback bigint,
  avg_rating      numeric
)
language sql
stable
as $fn$
  with b as (select coalesce(nullif(trim(p_tz), ''), 'UTC') as tz)
  select
    (select count(*) from public.visits),
    (select coalesce(sum(page_views), 0)::bigint from public.visits),
    (select count(*) from public.visits where started_quiz),
    (select count(*) from public.visits where finished_quiz),
    (select count(*) from public.visits v, b
      where timezone(b.tz, v.first_seen)::date = timezone(b.tz, now())::date),
    (select count(*) from public.attempts),
    (select count(*) from public.attempts a, b
      where timezone(b.tz, a.created_at)::date = timezone(b.tz, now())::date),
    (select count(*) from public.feedback),
    (select count(*) from public.feedback where not is_read),
    (select round(avg(rating)::numeric, 2) from public.feedback where rating > 0);
$fn$;

revoke all on function public.track_visit(text, text, text, text, text, text, text, text) from public;
revoke all on function public.mark_visit(text, text) from public;
revoke all on function public.submit_feedback(text, text, int, text, text, text) from public;
revoke all on function public.analytics_daily(int, text) from public;
revoke all on function public.analytics_totals(text) from public;

grant execute on function public.track_visit(text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.mark_visit(text, text) to anon, authenticated;
grant execute on function public.submit_feedback(text, text, int, text, text, text) to anon, authenticated;

-- Dashboard functions are for you, not for visitors.
grant execute on function public.analytics_daily(int, text) to authenticated;
grant execute on function public.analytics_totals(text)     to authenticated;


-- ============================================================
--  PART 2 - THE FINAL EXAM
--
--  A separate, graded exam for cyber security / ethical hacking
--  students. It shares nothing with the awareness quiz above except
--  the database it lives in - different tables, different rules.
--
--  The one rule that matters here: an exam question's correct answer
--  NEVER leaves this database. The quiz above ships its answers to the
--  browser, which is fine for an awareness quiz, but would make a
--  graded exam pointless - anyone could read them in DevTools. So the
--  anon role gets no read on exam_questions at all. Everything the
--  student's browser can do goes through the functions at the bottom,
--  each of which hands back only what that student is allowed to see.
-- ============================================================

-- ------------------------------------------------------------
-- E1. TABLES
-- ------------------------------------------------------------

-- Exam-wide settings. Exactly one row, id = 1.
create table if not exists public.exam_settings (
  id                      int     primary key default 1 check (id = 1),
  exam_open               boolean not null default false,

  -- How many of each type each student is served, picked at random
  -- from the active pool.
  mcq_count               int     not null default 20,
  written_count           int     not null default 3,
  practical_count         int     not null default 2,

  -- MCQ is timed per question. The other two sections get a shared
  -- budget for the whole section, in minutes.
  mcq_seconds             int     not null default 30,
  written_minutes         int     not null default 30,
  practical_minutes       int     not null default 30,

  pass_percent            int     not null default 40,

  -- Anti-cheat switches, all controllable from the admin panel.
  max_violations          int     not null default 3,
  require_fullscreen      boolean not null default true,
  block_copy              boolean not null default true,
  detect_tab_switch       boolean not null default true,
  shuffle_questions       boolean not null default true,
  shuffle_options         boolean not null default true,
  one_attempt_per_student boolean not null default true,

  exam_title              text    not null default 'Final Exam',
  exam_sub                text    not null default 'Cyber Security & Ethical Hacking',
  exam_closed_msg         text    not null default 'The exam is not open right now. Please check with your instructor.',
  exam_rules              text    not null default 'This exam is monitored. Leaving the tab, exiting fullscreen, copying or pasting is recorded and counts as a violation. Too many violations will submit your exam automatically.',
  updated_at              timestamptz not null default now()
);

insert into public.exam_settings (id) values (1) on conflict (id) do nothing;

-- The question bank. qtype decides which columns matter:
--   mcq       -> options (jsonb), auto-graded on submit
--   written   -> model_answer, graded by hand
--   practical -> model_answer, graded by hand
create table if not exists public.exam_questions (
  id           uuid primary key default gen_random_uuid(),
  qtype        text        not null default 'mcq'
                 check (qtype in ('mcq', 'written', 'practical')),
  sort_order   int         not null default 0,
  prompt       text        not null,
  -- [{"text":"...","correct":true}, ...]  - MCQ only.
  options      jsonb       not null default '[]'::jsonb,
  marks        int         not null default 1 check (marks between 1 and 100),
  model_answer text        not null default '',
  -- Shown to the student under the prompt. Handy for practical tasks
  -- ("list every command you ran").
  hint         text        not null default '',
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists exam_q_type_idx on public.exam_questions (qtype, sort_order);

-- One row per student, keyed by the student id they type in.
create table if not exists public.exam_students (
  id         uuid primary key default gen_random_uuid(),
  student_id text        not null unique,
  name       text        not null,
  batch      text        not null,
  email      text        not null,
  phone      text        not null,
  created_at timestamptz not null default now()
);

-- One row per sitting.
--
-- token is a secret handed to the browser when the exam starts and
-- required on every later call. It is what stops one student from
-- saving answers into, or submitting, somebody else's attempt - the
-- attempt id on its own is not enough.
create table if not exists public.exam_attempts (
  id              uuid primary key default gen_random_uuid(),
  student         uuid not null references public.exam_students(id) on delete cascade,
  token           uuid not null default gen_random_uuid(),
  status          text not null default 'in_progress'
                    check (status in ('in_progress', 'submitted', 'graded')),

  started_at      timestamptz not null default now(),
  -- Server-side deadline. The countdown in the browser is a convenience;
  -- this is the one that actually decides.
  deadline        timestamptz not null,
  submitted_at    timestamptz,

  mcq_score       int not null default 0,
  written_score   int not null default 0,
  practical_score int not null default 0,
  mcq_total       int not null default 0,
  written_total   int not null default 0,
  practical_total int not null default 0,

  auto_submitted  boolean not null default false,
  submit_reason   text,
  violation_count int not null default 0,

  graded_at       timestamptz,
  grader_note     text not null default '',
  user_agent      text,
  created_at      timestamptz not null default now()
);

create index if not exists exam_att_student_idx on public.exam_attempts (student, started_at desc);
create index if not exists exam_att_status_idx  on public.exam_attempts (status, submitted_at desc);

-- One row per question served to that attempt, written the moment the
-- exam starts. That fixes the paper: the set of questions a student got
-- stays auditable even if the bank is edited while they are sitting it.
create table if not exists public.exam_answers (
  id            uuid primary key default gen_random_uuid(),
  attempt       uuid not null references public.exam_attempts(id) on delete cascade,
  question      uuid not null references public.exam_questions(id) on delete cascade,
  qtype         text not null,
  position      int  not null default 0,
  -- The option order this student saw, so a shuffled MCQ can still be
  -- reviewed and re-graded correctly months later.
  shown_options jsonb not null default '[]'::jsonb,
  choice        int,
  answer_text   text not null default '',
  awarded       int  not null default 0,
  max_marks     int  not null default 1,
  is_correct    boolean,
  graded        boolean not null default false,
  feedback      text not null default '',
  answered_at   timestamptz,
  unique (attempt, question)
);

create index if not exists exam_ans_attempt_idx on public.exam_answers (attempt, position);

-- Every anti-cheat trip, with a timestamp. This is the part that
-- survives a student clearing their console.
create table if not exists public.exam_violations (
  id      uuid primary key default gen_random_uuid(),
  attempt uuid not null references public.exam_attempts(id) on delete cascade,
  kind    text not null,
  detail  text not null default '',
  at      timestamptz not null default now()
);

create index if not exists exam_viol_attempt_idx on public.exam_violations (attempt, at);

-- ------------------------------------------------------------
-- E2. ROW LEVEL SECURITY
--
--  Note what is NOT here: there is no anon policy on exam_questions,
--  exam_answers or exam_attempts. Students never touch these tables
--  directly. Their browser calls the security-definer functions in E3,
--  which is the only way in, and those functions never return a
--  correct answer.
-- ------------------------------------------------------------

alter table public.exam_settings   enable row level security;
alter table public.exam_questions  enable row level security;
alter table public.exam_students   enable row level security;
alter table public.exam_attempts   enable row level security;
alter table public.exam_answers    enable row level security;
alter table public.exam_violations enable row level security;

drop policy if exists "exam_settings_public_read" on public.exam_settings;
drop policy if exists "exam_settings_admin_write" on public.exam_settings;
drop policy if exists "exam_questions_admin_all"  on public.exam_questions;
drop policy if exists "exam_students_admin_all"   on public.exam_students;
drop policy if exists "exam_attempts_admin_all"   on public.exam_attempts;
drop policy if exists "exam_answers_admin_all"    on public.exam_answers;
drop policy if exists "exam_violations_admin_all" on public.exam_violations;

-- The landing page needs to know whether the exam is open and what the
-- rules say, so this one row is public. It holds no answers.
create policy "exam_settings_public_read" on public.exam_settings
  for select to anon, authenticated using (true);

create policy "exam_settings_admin_write" on public.exam_settings
  for update to authenticated using (true) with check (true);

-- Admins only, on everything else.
create policy "exam_questions_admin_all" on public.exam_questions
  for all to authenticated using (true) with check (true);

create policy "exam_students_admin_all" on public.exam_students
  for all to authenticated using (true) with check (true);

create policy "exam_attempts_admin_all" on public.exam_attempts
  for all to authenticated using (true) with check (true);

create policy "exam_answers_admin_all" on public.exam_answers
  for all to authenticated using (true) with check (true);

create policy "exam_violations_admin_all" on public.exam_violations
  for all to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- E3. FUNCTIONS THE STUDENT'S BROWSER CALLS
--
--  Every one of these takes the attempt id AND its token. The token is
--  checked on each call, so knowing (or guessing) an attempt id gets
--  you nothing. None of them ever returns a correct answer.
-- ------------------------------------------------------------

-- Strip the correct flags off an option array before it goes out to a
-- browser. Everything below funnels its options through this.
create or replace function public.exam_public_options(p_options jsonb)
returns jsonb
language sql
immutable
as $fn$
  select coalesce(
    jsonb_agg(jsonb_build_object('text', o->>'text') order by ord),
    '[]'::jsonb
  )
  from jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) with ordinality as t(o, ord);
$fn$;

-- Look up an in-progress attempt by id + token, or raise. Shared by
-- every call below so the check can never be forgotten in one of them.
create or replace function public.exam_guard(p_attempt uuid, p_token uuid)
returns public.exam_attempts
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_att public.exam_attempts;
begin
  select * into v_att
  from public.exam_attempts
  where id = p_attempt and token = p_token;

  if not found then
    raise exception 'bad_attempt';
  end if;

  if v_att.status <> 'in_progress' then
    raise exception 'already_submitted';
  end if;

  return v_att;
end
$fn$;

-- Start (or resume) an exam.
--
-- Resuming matters: a student whose browser crashes, or who is thrown
-- out by a flaky phone connection, gets their same paper back with
-- their answers intact and the original deadline still running. It also
-- means a refresh is not a way to draw an easier set of questions.
create or replace function public.exam_start(
  p_name       text,
  p_student_id text,
  p_batch      text,
  p_email      text,
  p_phone      text,
  p_user_agent text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_cfg      public.exam_settings;
  v_student  uuid;
  v_att      public.exam_attempts;
  v_id       uuid;
  v_token    uuid;
  v_deadline timestamptz;
  v_seconds  int;
  v_pos      int := 0;
  v_row      record;
  v_opts     jsonb;
begin
  select * into v_cfg from public.exam_settings where id = 1;
  if not coalesce(v_cfg.exam_open, false) then
    raise exception 'exam_closed';
  end if;

  -- All five fields are required. Trim first so a row of spaces is not
  -- accepted as a name.
  if nullif(trim(p_name), '')       is null then raise exception 'need_name';    end if;
  if nullif(trim(p_student_id), '') is null then raise exception 'need_student';  end if;
  if nullif(trim(p_batch), '')      is null then raise exception 'need_batch';    end if;
  if nullif(trim(p_email), '')      is null then raise exception 'need_email';    end if;
  if nullif(trim(p_phone), '')      is null then raise exception 'need_phone';    end if;

  if position('@' in p_email) = 0 then
    raise exception 'bad_email';
  end if;

  -- Upsert the student record on their student id.
  insert into public.exam_students (student_id, name, batch, email, phone)
  values (
    left(upper(trim(p_student_id)), 40),
    left(trim(p_name), 80),
    left(trim(p_batch), 40),
    left(lower(trim(p_email)), 120),
    left(trim(p_phone), 20)
  )
  on conflict (student_id) do update
    set name  = excluded.name,
        batch = excluded.batch,
        email = excluded.email,
        phone = excluded.phone
  returning id into v_student;

  -- An exam already running for this student? Hand it straight back.
  select * into v_att
  from public.exam_attempts
  where student = v_student and status = 'in_progress' and deadline > now()
  order by started_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'attempt',    v_att.id,
      'token',      v_att.token,
      'resumed',    true,
      'deadline',   v_att.deadline,
      'violations', v_att.violation_count,
      'config',     jsonb_build_object(
        'mcq_seconds',        v_cfg.mcq_seconds,
        'max_violations',     v_cfg.max_violations,
        'require_fullscreen', v_cfg.require_fullscreen,
        'block_copy',         v_cfg.block_copy,
        'detect_tab_switch',  v_cfg.detect_tab_switch
      ),
      'questions',  public.exam_paper(v_att.id)
    );
  end if;

  -- Not resuming. If one sitting per student is on, a finished attempt
  -- blocks a second one.
  if coalesce(v_cfg.one_attempt_per_student, true) and exists (
    select 1 from public.exam_attempts
    where student = v_student and status in ('submitted', 'graded')
  ) then
    raise exception 'already_attempted';
  end if;

  -- Total time = every MCQ at its own allowance, plus the two written
  -- sections' budgets.
  v_seconds := greatest(60,
      v_cfg.mcq_count * greatest(v_cfg.mcq_seconds, 5)
    + v_cfg.written_minutes * 60
    + v_cfg.practical_minutes * 60);
  v_deadline := now() + make_interval(secs => v_seconds);

  insert into public.exam_attempts (student, deadline, user_agent)
  values (v_student, v_deadline, left(coalesce(p_user_agent, ''), 400))
  returning id, token into v_id, v_token;

  -- Draw the paper: each section, random pick from the active pool,
  -- MCQ first so the timed section is over before the long answers.
  for v_row in
    select q.*, x.want
    from (values
      ('mcq',       coalesce(v_cfg.mcq_count, 0),       1),
      ('written',   coalesce(v_cfg.written_count, 0),   2),
      ('practical', coalesce(v_cfg.practical_count, 0), 3)
    ) as x(t, want, band)
    cross join lateral (
      select * from public.exam_questions eq
      where eq.is_active and eq.qtype = x.t
      order by case when coalesce(v_cfg.shuffle_questions, true)
                    then random()
                    else eq.sort_order::double precision end
      limit x.want
    ) q
    order by x.band, q.sort_order
  loop
    v_pos := v_pos + 1;

    -- Shuffle the options for this student, keeping the correct flag
    -- attached. It is stored, never sent.
    if v_row.qtype = 'mcq' and coalesce(v_cfg.shuffle_options, true) then
      select coalesce(jsonb_agg(o order by random()), '[]'::jsonb)
        into v_opts
      from jsonb_array_elements(v_row.options) as o;
    else
      v_opts := coalesce(v_row.options, '[]'::jsonb);
    end if;

    insert into public.exam_answers
      (attempt, question, qtype, position, shown_options, max_marks)
    values
      (v_id, v_row.id, v_row.qtype, v_pos, v_opts, greatest(v_row.marks, 1));
  end loop;

  if v_pos = 0 then
    -- No questions loaded yet: bin the empty attempt rather than leave
    -- the student staring at a blank paper.
    delete from public.exam_attempts where id = v_id;
    raise exception 'no_questions';
  end if;

  -- Record what the paper is worth, per section.
  update public.exam_attempts a set
    mcq_total       = (select coalesce(sum(max_marks),0) from public.exam_answers where attempt = v_id and qtype = 'mcq'),
    written_total   = (select coalesce(sum(max_marks),0) from public.exam_answers where attempt = v_id and qtype = 'written'),
    practical_total = (select coalesce(sum(max_marks),0) from public.exam_answers where attempt = v_id and qtype = 'practical')
  where a.id = v_id;

  return jsonb_build_object(
    'attempt',    v_id,
    'token',      v_token,
    'resumed',    false,
    'deadline',   v_deadline,
    'violations', 0,
    'config',     jsonb_build_object(
      'mcq_seconds',        v_cfg.mcq_seconds,
      'max_violations',     v_cfg.max_violations,
      'require_fullscreen', v_cfg.require_fullscreen,
      'block_copy',         v_cfg.block_copy,
      'detect_tab_switch',  v_cfg.detect_tab_switch
    ),
    'questions',  public.exam_paper(v_id)
  );
end
$fn$;

-- The paper as the student is allowed to see it: prompts, marks and
-- option TEXT only, plus whatever they have already answered.
create or replace function public.exam_paper(p_attempt uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',       a.question,
      'qtype',    a.qtype,
      'position', a.position,
      'prompt',   q.prompt,
      'hint',     q.hint,
      'marks',    a.max_marks,
      'options',  public.exam_public_options(a.shown_options),
      'choice',   a.choice,
      'text',     a.answer_text
    ) order by a.position
  ), '[]'::jsonb)
  from public.exam_answers a
  join public.exam_questions q on q.id = a.question
  where a.attempt = p_attempt;
$fn$;

-- Save one answer. Called on every pick and on a debounce while typing,
-- so a crashed browser loses seconds of work rather than an hour of it.
create or replace function public.exam_save_answer(
  p_attempt  uuid,
  p_token    uuid,
  p_question uuid,
  p_choice   int  default null,
  p_text     text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_att public.exam_attempts;
begin
  v_att := public.exam_guard(p_attempt, p_token);

  -- Past the deadline nothing more is accepted. The browser countdown
  -- is a courtesy; this is the line that actually holds.
  if v_att.deadline <= now() then
    raise exception 'time_up';
  end if;

  update public.exam_answers
     set choice      = case when p_choice is null then choice else p_choice end,
         answer_text = case when p_text   is null then answer_text
                            else left(p_text, 20000) end,
         answered_at = now()
   where attempt = p_attempt and question = p_question;

  if not found then
    raise exception 'not_on_paper';
  end if;

  return jsonb_build_object(
    'ok',        true,
    'seconds_left', greatest(0, floor(extract(epoch from (v_att.deadline - now())))::int)
  );
end
$fn$;

-- Record an anti-cheat trip and hand back the running count, so the
-- browser can show "warning 2 of 3" without trusting its own tally.
create or replace function public.exam_log_violation(
  p_attempt uuid,
  p_token   uuid,
  p_kind    text,
  p_detail  text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_att   public.exam_attempts;
  v_count int;
  v_max   int;
begin
  -- Deliberately not exam_guard(): a violation arriving just after the
  -- exam submitted is still worth keeping, and should not error.
  select * into v_att
  from public.exam_attempts
  where id = p_attempt and token = p_token;

  if not found then
    raise exception 'bad_attempt';
  end if;

  insert into public.exam_violations (attempt, kind, detail)
  values (p_attempt, left(coalesce(p_kind, 'unknown'), 40), left(coalesce(p_detail, ''), 300));

  update public.exam_attempts
     set violation_count = violation_count + 1
   where id = p_attempt
  returning violation_count into v_count;

  select max_violations into v_max from public.exam_settings where id = 1;

  return jsonb_build_object(
    'count',    v_count,
    'max',      coalesce(v_max, 3),
    'over',     v_count >= coalesce(v_max, 3)
  );
end
$fn$;

-- Finish the exam and mark the MCQ section. Written and practical are
-- left for a human, so the attempt lands on 'submitted', not 'graded'.
create or replace function public.exam_submit(
  p_attempt uuid,
  p_token   uuid,
  p_auto    boolean default false,
  p_reason  text    default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_att   public.exam_attempts;
  v_score int;
begin
  v_att := public.exam_guard(p_attempt, p_token);

  -- Mark every MCQ by looking at the option the student actually
  -- clicked, in the order they actually saw.
  update public.exam_answers a
     set is_correct = coalesce(
           (a.shown_options -> a.choice ->> 'correct')::boolean, false),
         awarded = case when coalesce(
           (a.shown_options -> a.choice ->> 'correct')::boolean, false)
           then a.max_marks else 0 end,
         graded = true
   where a.attempt = p_attempt and a.qtype = 'mcq';

  select coalesce(sum(awarded), 0) into v_score
  from public.exam_answers
  where attempt = p_attempt and qtype = 'mcq';

  update public.exam_attempts
     set status         = 'submitted',
         submitted_at   = now(),
         mcq_score      = v_score,
         auto_submitted = coalesce(p_auto, false),
         submit_reason  = left(p_reason, 120)
   where id = p_attempt;

  -- The student is told their MCQ mark and that the rest is pending.
  -- They are not shown which ones they got wrong.
  return jsonb_build_object(
    'ok',            true,
    'mcq_score',     v_score,
    'mcq_total',     v_att.mcq_total,
    'awaiting',      v_att.written_total + v_att.practical_total,
    'auto',          coalesce(p_auto, false)
  );
end
$fn$;

-- A light poll so the browser can resync its countdown against the
-- server clock instead of its own, which a student can change.
create or replace function public.exam_ping(p_attempt uuid, p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_att public.exam_attempts;
begin
  select * into v_att
  from public.exam_attempts
  where id = p_attempt and token = p_token;

  if not found then
    raise exception 'bad_attempt';
  end if;

  return jsonb_build_object(
    'status',       v_att.status,
    'violations',   v_att.violation_count,
    'seconds_left', greatest(0, floor(extract(epoch from (v_att.deadline - now())))::int)
  );
end
$fn$;

-- ------------------------------------------------------------
-- E4. FUNCTIONS THE ADMIN PANEL CALLS
--     authenticated only - these do show correct answers.
-- ------------------------------------------------------------

-- Mark one written or practical answer, then roll the section totals
-- up onto the attempt so the results table stays consistent.
create or replace function public.exam_grade(
  p_answer   uuid,
  p_awarded  int,
  p_feedback text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_attempt uuid;
  v_max     int;
begin
  select attempt, max_marks into v_attempt, v_max
  from public.exam_answers where id = p_answer;

  if not found then
    raise exception 'no_such_answer';
  end if;

  update public.exam_answers
     set awarded  = greatest(0, least(coalesce(p_awarded, 0), v_max)),
         feedback = left(coalesce(p_feedback, ''), 2000),
         graded   = true
   where id = p_answer;

  update public.exam_attempts a set
    written_score   = (select coalesce(sum(awarded),0) from public.exam_answers where attempt = v_attempt and qtype = 'written'),
    practical_score = (select coalesce(sum(awarded),0) from public.exam_answers where attempt = v_attempt and qtype = 'practical')
  where a.id = v_attempt;

  return jsonb_build_object('ok', true, 'attempt', v_attempt);
end
$fn$;

-- Close the book on an attempt once every answer has a mark.
create or replace function public.exam_finalize(
  p_attempt uuid,
  p_note    text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_left int;
begin
  select count(*) into v_left
  from public.exam_answers
  where attempt = p_attempt and not graded;

  if v_left > 0 then
    raise exception 'ungraded_answers';
  end if;

  update public.exam_attempts
     set status     = 'graded',
         graded_at  = now(),
         grader_note = left(coalesce(p_note, ''), 2000)
   where id = p_attempt;

  return jsonb_build_object('ok', true);
end
$fn$;

-- Everything the admin needs about one attempt, correct answers and
-- violation log included.
create or replace function public.exam_review(p_attempt uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  select jsonb_build_object(
    'attempt', to_jsonb(a) - 'token',
    'student', to_jsonb(s),
    'answers', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'answer_id',  an.id,
          'qtype',      an.qtype,
          'position',   an.position,
          'prompt',     q.prompt,
          'model',      q.model_answer,
          'options',    an.shown_options,
          'choice',     an.choice,
          'text',       an.answer_text,
          'awarded',    an.awarded,
          'max_marks',  an.max_marks,
          'is_correct', an.is_correct,
          'graded',     an.graded,
          'feedback',   an.feedback
        ) order by an.position
      ), '[]'::jsonb)
      from public.exam_answers an
      join public.exam_questions q on q.id = an.question
      where an.attempt = a.id
    ),
    'violations', (
      select coalesce(jsonb_agg(
        jsonb_build_object('kind', v.kind, 'detail', v.detail, 'at', v.at)
        order by v.at
      ), '[]'::jsonb)
      from public.exam_violations v where v.attempt = a.id
    )
  )
  from public.exam_attempts a
  join public.exam_students s on s.id = a.student
  where a.id = p_attempt;
$fn$;

-- Tiles for the exam dashboard.
create or replace function public.exam_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  select jsonb_build_object(
    'students',    (select count(*) from public.exam_students),
    'in_progress', (select count(*) from public.exam_attempts where status = 'in_progress'),
    'submitted',   (select count(*) from public.exam_attempts where status = 'submitted'),
    'graded',      (select count(*) from public.exam_attempts where status = 'graded'),
    'flagged',     (select count(*) from public.exam_attempts where violation_count > 0),
    'auto',        (select count(*) from public.exam_attempts where auto_submitted),
    'questions',   (select count(*) from public.exam_questions where is_active),
    'avg_percent', (
      select coalesce(round(avg(
        case when (mcq_total + written_total + practical_total) > 0
             then (mcq_score + written_score + practical_score)::numeric
                  / (mcq_total + written_total + practical_total) * 100
             else 0 end))::int, 0)
      from public.exam_attempts where status = 'graded'
    )
  );
$fn$;

-- ------------------------------------------------------------
-- E5. GRANTS
--     Students get exactly the five calls they need. Everything that
--     can see a correct answer is admin-only.
-- ------------------------------------------------------------

revoke all on function public.exam_start(text, text, text, text, text, text) from public;
revoke all on function public.exam_save_answer(uuid, uuid, uuid, int, text)  from public;
revoke all on function public.exam_log_violation(uuid, uuid, text, text)     from public;
revoke all on function public.exam_submit(uuid, uuid, boolean, text)         from public;
revoke all on function public.exam_ping(uuid, uuid)                          from public;
revoke all on function public.exam_paper(uuid)                               from public;
revoke all on function public.exam_guard(uuid, uuid)                         from public;
revoke all on function public.exam_grade(uuid, int, text)                    from public;
revoke all on function public.exam_finalize(uuid, text)                      from public;
revoke all on function public.exam_review(uuid)                              from public;
revoke all on function public.exam_stats()                                   from public;

grant execute on function public.exam_start(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.exam_save_answer(uuid, uuid, uuid, int, text)  to anon, authenticated;
grant execute on function public.exam_log_violation(uuid, uuid, text, text)     to anon, authenticated;
grant execute on function public.exam_submit(uuid, uuid, boolean, text)         to anon, authenticated;
grant execute on function public.exam_ping(uuid, uuid)                          to anon, authenticated;

-- exam_paper and exam_guard are helpers called from inside the
-- functions above, which run as their owner. No role needs them directly.
grant execute on function public.exam_grade(uuid, int, text) to authenticated;
grant execute on function public.exam_finalize(uuid, text)   to authenticated;
grant execute on function public.exam_review(uuid)           to authenticated;
grant execute on function public.exam_stats()                to authenticated;

-- ------------------------------------------------------------
-- E6. SEED - a few questions of each type, so the exam is runnable
--     the moment you open it. Only fires when the bank is empty.
-- ------------------------------------------------------------

do $seed$
begin
if not exists (select 1 from public.exam_questions) then

insert into public.exam_questions (qtype, sort_order, prompt, options, marks, model_answer, hint) values
('mcq', 1,
 'Which Nmap flag performs a TCP SYN (half-open) scan?',
 '[{"text":"-sS","correct":true},{"text":"-sT","correct":false},{"text":"-sU","correct":false},{"text":"-sn","correct":false}]'::jsonb,
 1, '', ''),
('mcq', 2,
 'An attacker captures a session cookie over unencrypted HTTP and reuses it to log in as the victim. What is this called?',
 '[{"text":"Session hijacking","correct":true},{"text":"SQL injection","correct":false},{"text":"Privilege escalation","correct":false},{"text":"DNS poisoning","correct":false}]'::jsonb,
 1, '', ''),
('mcq', 3,
 'Which HTTP response header is the primary defence against clickjacking?',
 '[{"text":"X-Frame-Options / frame-ancestors","correct":true},{"text":"X-Powered-By","correct":false},{"text":"Accept-Encoding","correct":false},{"text":"Cache-Control","correct":false}]'::jsonb,
 1, '', ''),
('mcq', 4,
 'In the OWASP Top 10, storing passwords with unsalted MD5 falls under which category?',
 '[{"text":"Cryptographic Failures","correct":true},{"text":"Broken Access Control","correct":false},{"text":"Security Misconfiguration","correct":false},{"text":"SSRF","correct":false}]'::jsonb,
 1, '', ''),
('mcq', 5,
 'What does a WAF primarily protect?',
 '[{"text":"Web application traffic at layer 7","correct":true},{"text":"Physical server access","correct":false},{"text":"Database backups at rest","correct":false},{"text":"Employee email inboxes","correct":false}]'::jsonb,
 1, '', ''),

('written', 1,
 'Explain the difference between symmetric and asymmetric encryption. Give one realistic use for each, and say why that use suits that type.',
 '[]'::jsonb, 10,
 'Symmetric: one shared key for encrypt and decrypt, fast, good for bulk data (disk/database encryption, the data channel of a TLS session). Asymmetric: a public/private key pair, slow, solves key distribution and identity (TLS handshake, code signing, PGP email). Strong answers note that real systems use asymmetric to agree a symmetric key, then switch.',
 'Around 150-250 words is plenty.'),
('written', 2,
 'A client reports their WordPress site is redirecting visitors to a gambling page, but only for visitors arriving from Google. Describe how you would investigate, in order, and what you would check at each step.',
 '[]'::jsonb, 10,
 'Expect: reproduce with a spoofed Google referrer/user-agent; check for conditional redirect logic in theme files, .htaccess, wp-config and the database (wp_options siteurl/home, injected scripts in posts); compare file hashes against a clean WordPress copy; review recently modified files and access logs around that time; check plugin/theme versions against known CVEs and any unknown admin users; then containment, clean restore from backup, credential rotation, and patching the entry point.',
 'Marks are for method and order, not for naming one magic tool.'),

('practical', 1,
 'You have been given written authorisation to test a single host, 10.10.10.25, on an internal lab network. Write out the reconnaissance phase exactly as you would run it: every command in order, what each one is for, and what you would look for in the output before moving on.',
 '[]'::jsonb, 15,
 'Expect a sensible ordered progression: host discovery, a full or staged port scan, service and version detection, then targeted enumeration per service found. Commands should be real and correctly flagged. Credit reasoning about output (which ports/versions would change the next step) over a long list of pasted commands. Deduct for anything out of the authorised scope.',
 'Write the commands as plain text, one per line, with a short note under each.'),
('practical', 2,
 'A junior colleague has written this login check and asks you to review it: a PHP page that builds the query "SELECT * FROM users WHERE user = $_POST[user] AND pass = md5($_POST[pass])" and logs the user in if a row comes back. Identify every security problem you can see, and rewrite the logic safely in pseudocode.',
 '[]'::jsonb, 15,
 'Should identify at minimum: SQL injection via unparameterised input (both fields), unsalted MD5 for password storage, no rate limiting or lockout, likely no HTTPS/secure session handling, and username enumeration. Safe rewrite should use a parameterised query, a slow salted hash (bcrypt/argon2) verified with a constant-time compare, session regeneration on login, and a generic failure message.',
 'List the problems first, then the rewrite.');

end if;
end
$seed$;
