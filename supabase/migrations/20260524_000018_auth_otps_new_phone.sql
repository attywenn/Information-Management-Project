begin;

alter table public.auth_otps
  add column if not exists new_phone citext;

commit;