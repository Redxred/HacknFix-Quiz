-- Run in the Supabase SQL Editor. Existing exams and questions are unchanged.
begin;
create table if not exists public.certificate_settings (
  id integer primary key default 1 check(id=1),
  organization text not null default 'GM IT Academy' check(length(organization) between 1 and 100),
  title text not null default 'CERTIFICATE OF ASSESSMENT' check(length(title) between 1 and 100),
  description text not null default 'has completed the assessment in' check(length(description)<=250),
  signature_name text not null default '' check(length(signature_name)<=100),
  signature_role text not null default 'Authorized signatory' check(length(signature_role)<=100),
  footer text not null default 'Recognizing learning, effort and achievement.' check(length(footer)<=200),
  primary_color text not null default '#1B2653' check(primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null default '#90A3D4' check(accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  text_color text not null default '#1B2653' check(text_color ~ '^#[0-9A-Fa-f]{6}$'),
  background_color text not null default '#FAFBFF' check(background_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_data text not null default '' check(length(logo_data)<=1500000),
  signature_data text not null default '' check(length(signature_data)<=500000),
  show_result boolean not null default true,
  pass_percent numeric not null default 40 check(pass_percent between 0 and 100),
  updated_at timestamptz not null default now()
);
insert into public.certificate_settings(id) values(1) on conflict(id) do nothing;
update public.certificate_settings set organization='GM IT Academy',primary_color='#1B2653',
  accent_color='#90A3D4',text_color='#1B2653',background_color='#FAFBFF'
  where id=1 and organization='HacknFix' and primary_color='#176B52'
    and accent_color='#C8A359' and logo_data='';
create table if not exists public.certificate_records (
  id uuid primary key default gen_random_uuid(),
  subject text not null check(subject in ('cyber','video','graphic','computer')),
  student_id text not null check(length(trim(student_id)) between 1 and 80),
  student_name text not null check(length(trim(student_name)) between 1 and 100),
  batch text not null default '' check(length(batch)<=80),
  email text not null default '' check(length(email)<=120),
  assessment text not null default 'Subject assessment' check(length(trim(assessment)) between 1 and 100),
  mcq_score numeric(10,2) not null default 0,
  mcq_total numeric(10,2) not null default 0,
  written_score numeric(10,2) not null default 0,
  written_total numeric(10,2) not null default 0,
  practical_score numeric(10,2) not null default 0,
  practical_total numeric(10,2) not null default 0,
  issued_on date not null default current_date,
  source_kind text not null default 'manual' check(source_kind in ('manual','quiz','exam')),
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(mcq_total between 0 and 100000 and mcq_score between 0 and mcq_total),
  check(written_total between 0 and 100000 and written_score between 0 and written_total),
  check(practical_total between 0 and 100000 and practical_score between 0 and practical_total),
  check(mcq_total+written_total+practical_total>0)
);
create unique index if not exists certificate_student_assessment_key
  on public.certificate_records(subject,upper(trim(student_id)),lower(trim(assessment)));
create unique index if not exists certificate_source_key
  on public.certificate_records(source_kind,source_id) where source_id is not null;
create index if not exists certificate_subject_date_idx on public.certificate_records(subject,issued_on desc,id);
alter table public.certificate_settings enable row level security;
alter table public.certificate_records enable row level security;
revoke all on public.certificate_settings, public.certificate_records from anon;
grant select,insert,update,delete on public.certificate_records to authenticated;
grant select,update on public.certificate_settings to authenticated;
drop policy if exists certificate_records_admin on public.certificate_records;
create policy certificate_records_admin on public.certificate_records
  for all to authenticated using(true) with check(true);
drop policy if exists certificate_settings_read on public.certificate_settings;
create policy certificate_settings_read on public.certificate_settings for select to authenticated using(true);
drop policy if exists certificate_settings_update on public.certificate_settings;
create policy certificate_settings_update on public.certificate_settings for update to authenticated using(true) with check(true);
commit;
