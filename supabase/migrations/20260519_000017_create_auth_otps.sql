begin;

create extension if not exists pgcrypto;

create table if not exists public.auth_otps (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete cascade,
    phone citext,
    otp_hash text not null,
    purpose text not null default 'auth',
    attempts int not null default 0,
    consumed boolean not null default false,
    created_at timestamptz not null default timezone('utc', now()),
    expires_at timestamptz not null
);

create index if not exists idx_auth_otps_user_id on public.auth_otps(user_id);
create index if not exists idx_auth_otps_created_at on public.auth_otps(created_at);

commit;
