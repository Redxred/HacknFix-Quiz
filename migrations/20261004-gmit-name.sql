-- Update existing certificate settings to the current GM IT name.
-- Copyright © 2026 HacknFix. Developed by Pritam Nath Dipta.
begin;
alter table public.certificate_settings alter column organization set default 'GM IT';
update public.certificate_settings
  set organization='GM IT', updated_at=now()
  where organization='GM IT Academy';
commit;
