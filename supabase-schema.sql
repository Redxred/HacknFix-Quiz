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
create or replace function public.submit_attempt(
  p_name  text,
  p_phone text,
  p_email text,
  p_score int,
  p_total int,
  p_lang  text
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

  insert into public.attempts (name, phone, email, score, total, lang)
  values (
    left(coalesce(nullif(trim(p_name), ''), 'Guest'), 60),
    left(nullif(trim(p_phone), ''), 20),
    left(nullif(trim(p_email), ''), 120),
    p_score,
    p_total,
    case when p_lang in ('bn', 'en') then p_lang else 'bn' end
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

revoke all on function public.submit_attempt(text, text, text, int, int, text) from public;
revoke all on function public.leaderboard(int) from public;
grant execute on function public.submit_attempt(text, text, text, int, int, text) to anon, authenticated;
grant execute on function public.leaderboard(int) to anon, authenticated;

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
