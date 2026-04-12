begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

-- Enums
DO $$
BEGIN
    CREATE TYPE public.app_role AS ENUM ('patient', 'health_worker', 'admin');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE public.appointment_status AS ENUM ('booked', 'cancelled', 'consulted', 'no_show');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE public.inventory_category AS ENUM ('medicine', 'aid');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE public.inventory_movement_type AS ENUM ('add', 'reduce', 'dispense');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Sequences and deterministic code generators
create sequence if not exists public.patient_code_seq start 1;
create sequence if not exists public.health_worker_license_seq start 1;
create sequence if not exists public.admin_code_seq start 1;

create or replace function public.generate_patient_code()
returns text
language plpgsql
as $$
declare
    digits text;
begin
    digits := lpad(nextval('public.patient_code_seq')::text, 12, '0');
    return 'PATIENT' || digits;
end;
$$;

create or replace function public.generate_health_worker_license()
returns text
language plpgsql
as $$
declare
    digits text;
begin
    digits := lpad(nextval('public.health_worker_license_seq')::text, 9, '0');
    return 'BSP-HW-' || substr(digits, 1, 4) || '-' || substr(digits, 5, 5);
end;
$$;

create or replace function public.generate_admin_code()
returns text
language plpgsql
as $$
declare
    digits text;
begin
    digits := lpad(nextval('public.admin_code_seq')::text, 6, '0');
    return 'BSP-ADM-' || digits;
end;
$$;

-- Shared lookup tables
create table if not exists public.security_questions (
    id smallserial primary key,
    question_text citext not null unique,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.symptoms (
    id smallserial primary key,
    name citext not null unique,
    created_at timestamptz not null default timezone('utc', now())
);

-- Core identity and role tables (3NF)
create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    role public.app_role not null default 'patient',
    username citext not null unique,
    email citext not null unique,
    display_name text not null,
    avatar_url text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.addresses (
    id bigserial primary key,
    region text not null,
    province text not null,
    city text not null,
    barangay text not null,
    house_number text not null,
    street text not null,
    purok_subdivision text not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    unique (region, province, city, barangay, house_number, street, purok_subdivision)
);

create table if not exists public.patient_profiles (
    user_id uuid primary key references public.profiles (id) on delete cascade,
    patient_code text not null unique,
    surname text not null,
    firstname text not null,
    middlename text,
    dob date,
    contact_number text,
    address_id bigint references public.addresses (id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.health_worker_profiles (
    user_id uuid primary key references public.profiles (id) on delete cascade,
    license_number text not null unique,
    surname text not null,
    firstname text not null,
    middlename text,
    dob date,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_profiles (
    user_id uuid primary key references public.profiles (id) on delete cascade,
    admin_code text not null unique default public.generate_admin_code(),
    pin_code text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_security_answers (
    user_id uuid primary key references public.profiles (id) on delete cascade,
    security_question_id smallint not null references public.security_questions (id),
    answer_hash text not null,
    updated_at timestamptz not null default timezone('utc', now()),
    constraint user_security_answers_hash_len_chk check (length(answer_hash) >= 32)
);

-- Scheduling and consultations
create table if not exists public.appointments (
    id uuid primary key default gen_random_uuid(),
    patient_user_id uuid not null references public.patient_profiles (user_id) on delete restrict,
    booked_by_user_id uuid not null references public.profiles (id) on delete restrict,
    scheduled_date date not null,
    time_slot text not null,
    status public.appointment_status not null default 'booked',
    qr_value text not null unique,
    other_symptom_text text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    unique (patient_user_id, scheduled_date, time_slot)
);

create table if not exists public.appointment_symptoms (
    appointment_id uuid not null references public.appointments (id) on delete cascade,
    symptom_id smallint not null references public.symptoms (id) on delete restrict,
    created_at timestamptz not null default timezone('utc', now()),
    primary key (appointment_id, symptom_id)
);

create table if not exists public.consultations (
    id uuid primary key default gen_random_uuid(),
    appointment_id uuid not null unique references public.appointments (id) on delete restrict,
    patient_user_id uuid not null references public.patient_profiles (user_id) on delete restrict,
    health_worker_user_id uuid not null references public.health_worker_profiles (user_id) on delete restrict,
    diagnosis text not null,
    note text not null,
    started_at timestamptz not null,
    completed_at timestamptz not null,
    duration_seconds integer not null check (duration_seconds > 0),
    proof_image_url text not null,
    created_at timestamptz not null default timezone('utc', now()),
    constraint consultations_time_order_chk check (completed_at >= started_at)
);

-- Inventory
create table if not exists public.inventory_items (
    id uuid primary key default gen_random_uuid(),
    name citext not null,
    category public.inventory_category not null,
    unit text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    unique (name, category)
);

create table if not exists public.inventory_balances (
    item_id uuid primary key references public.inventory_items (id) on delete cascade,
    quantity integer not null default 0 check (quantity >= 0),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.inventory_movements (
    id uuid primary key default gen_random_uuid(),
    item_id uuid not null references public.inventory_items (id) on delete restrict,
    moved_by_user_id uuid not null references public.profiles (id) on delete restrict,
    movement_type public.inventory_movement_type not null,
    quantity integer not null check (quantity > 0),
    consultation_id uuid references public.consultations (id) on delete set null,
    note text,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.consultation_items (
    consultation_id uuid not null references public.consultations (id) on delete cascade,
    item_id uuid not null references public.inventory_items (id) on delete restrict,
    quantity integer not null check (quantity > 0),
    created_at timestamptz not null default timezone('utc', now()),
    primary key (consultation_id, item_id)
);

-- Messaging / inbox
create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    sender_user_id uuid not null references public.profiles (id) on delete restrict,
    subject text not null,
    body text not null,
    message_type text not null default 'inbox',
    appointment_id uuid references public.appointments (id) on delete set null,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.message_recipients (
    message_id uuid not null references public.messages (id) on delete cascade,
    recipient_user_id uuid not null references public.profiles (id) on delete cascade,
    read_at timestamptz,
    primary key (message_id, recipient_user_id)
);

-- Indexes for foreign keys and high-frequency filters
create index if not exists idx_patient_profiles_address_id on public.patient_profiles (address_id);
create index if not exists idx_appointments_patient_date on public.appointments (patient_user_id, scheduled_date);
create index if not exists idx_appointments_status_date on public.appointments (status, scheduled_date);
create index if not exists idx_appointment_symptoms_symptom_id on public.appointment_symptoms (symptom_id);
create index if not exists idx_consultations_patient on public.consultations (patient_user_id, completed_at desc);
create index if not exists idx_consultations_worker on public.consultations (health_worker_user_id, completed_at desc);
create index if not exists idx_inventory_movements_item on public.inventory_movements (item_id, created_at desc);
create index if not exists idx_inventory_movements_consultation on public.inventory_movements (consultation_id);
create index if not exists idx_messages_sender_created on public.messages (sender_user_id, created_at desc);
create index if not exists idx_message_recipients_recipient_unread on public.message_recipients (recipient_user_id, read_at);

-- Generic updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_addresses_updated_at on public.addresses;
create trigger set_addresses_updated_at
before update on public.addresses
for each row execute function public.set_updated_at();

drop trigger if exists set_patient_profiles_updated_at on public.patient_profiles;
create trigger set_patient_profiles_updated_at
before update on public.patient_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_health_worker_profiles_updated_at on public.health_worker_profiles;
create trigger set_health_worker_profiles_updated_at
before update on public.health_worker_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_admin_profiles_updated_at on public.admin_profiles;
create trigger set_admin_profiles_updated_at
before update on public.admin_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

drop trigger if exists set_inventory_items_updated_at on public.inventory_items;
create trigger set_inventory_items_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

-- Inventory stock movement application (serialized per item row)
create or replace function public.apply_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    current_qty integer;
    next_qty integer;
begin
    insert into public.inventory_balances (item_id, quantity, updated_at)
    values (new.item_id, 0, timezone('utc', now()))
    on conflict (item_id) do nothing;

    select quantity
      into current_qty
      from public.inventory_balances
     where item_id = new.item_id
     for update;

    if new.movement_type = 'add' then
        next_qty := current_qty + new.quantity;
    else
        next_qty := current_qty - new.quantity;
        if next_qty < 0 then
            raise exception 'Insufficient stock for item %', new.item_id;
        end if;
    end if;

    update public.inventory_balances
       set quantity = next_qty,
           updated_at = timezone('utc', now())
     where item_id = new.item_id;

    return new;
end;
$$;

drop trigger if exists inventory_movement_apply on public.inventory_movements;
create trigger inventory_movement_apply
before insert on public.inventory_movements
for each row execute function public.apply_inventory_movement();

-- Automatically mark appointment as consulted when consultation is recorded
create or replace function public.mark_appointment_consulted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.appointments
       set status = 'consulted',
           updated_at = timezone('utc', now())
     where id = new.appointment_id;
    return new;
end;
$$;

drop trigger if exists consultation_marks_appointment on public.consultations;
create trigger consultation_marks_appointment
after insert on public.consultations
for each row execute function public.mark_appointment_consulted();

-- Sync auth.users -> normalized role tables
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
    role_text text := lower(coalesce(metadata->>'app_role', 'patient'));
    resolved_role public.app_role := case
        when role_text in ('patient', 'health_worker', 'admin') then role_text::public.app_role
        else 'patient'::public.app_role
    end;
    resolved_username text := coalesce(nullif(lower(metadata->>'username'), ''), split_part(lower(new.email), '@', 1));
    resolved_display_name text := coalesce(nullif(metadata->>'display_name', ''), nullif(metadata->>'firstname', ''), resolved_username);
    address_row_id bigint;
    question_id smallint;
    answer_text text;
begin
    insert into public.profiles (id, role, username, email, display_name)
    values (new.id, resolved_role, resolved_username, lower(new.email), resolved_display_name)
    on conflict (id) do update
       set role = excluded.role,
           username = excluded.username,
           email = excluded.email,
           display_name = excluded.display_name,
           updated_at = timezone('utc', now());

    if resolved_role = 'patient' then
        if coalesce(nullif(metadata->>'house_number', ''), '') <> ''
           and coalesce(nullif(metadata->>'street', ''), '') <> ''
           and coalesce(nullif(metadata->>'purok_subdivision', ''), '') <> '' then
            insert into public.addresses (
                region,
                province,
                city,
                barangay,
                house_number,
                street,
                purok_subdivision
            )
            values (
                coalesce(nullif(metadata->>'region', ''), 'NCR'),
                coalesce(nullif(metadata->>'province', ''), 'METRO MANILA'),
                coalesce(nullif(metadata->>'city', ''), 'SAN JUAN CITY'),
                coalesce(nullif(metadata->>'barangay', ''), 'BARANGAY SAN PERFECTO'),
                metadata->>'house_number',
                metadata->>'street',
                metadata->>'purok_subdivision'
            )
            on conflict (region, province, city, barangay, house_number, street, purok_subdivision)
            do update set updated_at = timezone('utc', now())
            returning id into address_row_id;
        end if;

        insert into public.patient_profiles (
            user_id,
            patient_code,
            surname,
            firstname,
            middlename,
            dob,
            contact_number,
            address_id
        )
        values (
            new.id,
            coalesce(nullif(metadata->>'patient_code', ''), public.generate_patient_code()),
            coalesce(nullif(metadata->>'surname', ''), 'N/A'),
            coalesce(nullif(metadata->>'firstname', ''), resolved_username),
            nullif(metadata->>'middlename', ''),
            case when coalesce(nullif(metadata->>'dob', ''), '') <> '' then (metadata->>'dob')::date else null end,
            nullif(metadata->>'contact_number', ''),
            address_row_id
        )
        on conflict (user_id) do update
           set patient_code = excluded.patient_code,
               surname = excluded.surname,
               firstname = excluded.firstname,
               middlename = excluded.middlename,
               dob = excluded.dob,
               contact_number = excluded.contact_number,
               address_id = coalesce(excluded.address_id, public.patient_profiles.address_id),
               updated_at = timezone('utc', now());
    elsif resolved_role = 'health_worker' then
        insert into public.health_worker_profiles (
            user_id,
            license_number,
            surname,
            firstname,
            middlename,
            dob
        )
        values (
            new.id,
            coalesce(nullif(metadata->>'license_number', ''), public.generate_health_worker_license()),
            coalesce(nullif(metadata->>'surname', ''), 'N/A'),
            coalesce(nullif(metadata->>'firstname', ''), resolved_username),
            nullif(metadata->>'middlename', ''),
            case when coalesce(nullif(metadata->>'dob', ''), '') <> '' then (metadata->>'dob')::date else null end
        )
        on conflict (user_id) do update
           set license_number = excluded.license_number,
               surname = excluded.surname,
               firstname = excluded.firstname,
               middlename = excluded.middlename,
               dob = excluded.dob,
               updated_at = timezone('utc', now());
    elsif resolved_role = 'admin' then
        insert into public.admin_profiles (
            user_id,
            admin_code,
            pin_code
        )
        values (
            new.id,
            coalesce(nullif(metadata->>'admin_code', ''), public.generate_admin_code()),
            nullif(metadata->>'pin_code', '')
        )
        on conflict (user_id) do update
           set admin_code = coalesce(excluded.admin_code, public.admin_profiles.admin_code),
               pin_code = coalesce(excluded.pin_code, public.admin_profiles.pin_code),
               updated_at = timezone('utc', now());
    end if;

    if coalesce(nullif(metadata->>'security_question_id', ''), '') ~ '^[0-9]+$'
       and coalesce(nullif(metadata->>'security_answer', ''), '') <> '' then
        question_id := (metadata->>'security_question_id')::smallint;
        answer_text := lower(trim(metadata->>'security_answer'));

        insert into public.user_security_answers (
            user_id,
            security_question_id,
            answer_hash,
            updated_at
        )
        values (
            new.id,
            question_id,
            encode(extensions.digest(answer_text, 'sha256'), 'hex'),
            timezone('utc', now())
        )
        on conflict (user_id) do update
           set security_question_id = excluded.security_question_id,
               answer_hash = excluded.answer_hash,
               updated_at = timezone('utc', now());
    end if;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    update public.profiles
       set email = lower(new.email),
           updated_at = timezone('utc', now())
     where id = new.id;

    return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update of email on auth.users
for each row execute function public.handle_auth_user_updated();

-- JWT + role helpers
create or replace function public.current_user_role()
returns public.app_role
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    jwt_role text;
    profile_role public.app_role;
begin
    jwt_role := auth.jwt() -> 'app_metadata' ->> 'app_role';

    if jwt_role in ('patient', 'health_worker', 'admin') then
        return jwt_role::public.app_role;
    end if;

    select role
      into profile_role
      from public.profiles
     where id = auth.uid();

    return coalesce(profile_role, 'patient'::public.app_role);
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.current_user_role() = 'admin'::public.app_role;
$$;

create or replace function public.is_health_worker()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.current_user_role() = 'health_worker'::public.app_role;
$$;

-- Login helper for patient ID / worker license / admin code or email/username
create or replace function public.lookup_login_identity(
    p_identifier text,
    p_role public.app_role default null,
    p_dob date default null
)
returns table (
    user_id uuid,
    email text,
    username text,
    role public.app_role,
    patient_code text,
    license_number text,
    admin_code text
)
language sql
stable
security definer
set search_path = public
as $$
    with base as (
        select
            p.id as user_id,
            p.email::text as email,
            p.username::text as username,
            p.role,
            pp.patient_code,
            pp.dob,
            hw.license_number,
            ap.admin_code
        from public.profiles p
        left join public.patient_profiles pp on pp.user_id = p.id
        left join public.health_worker_profiles hw on hw.user_id = p.id
        left join public.admin_profiles ap on ap.user_id = p.id
    )
    select
        b.user_id,
        b.email,
        b.username,
        b.role,
        b.patient_code,
        b.license_number,
        b.admin_code
    from base b
    where lower(trim(p_identifier)) = any (
        array[
            lower(b.email),
            lower(b.username),
            lower(coalesce(b.patient_code, '')),
            lower(coalesce(b.license_number, '')),
            lower(coalesce(b.admin_code, ''))
        ]
    )
      and (p_role is null or b.role = p_role)
      and (
        p_role is distinct from 'patient'::public.app_role
        or p_dob is null
        or b.dob = p_dob
      )
    limit 1;
$$;

create or replace function public.verify_security_answer(
    p_identifier text,
    p_role public.app_role,
    p_question_id smallint,
    p_answer text,
    p_dob date default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_stored_hash text;
begin
    select lli.user_id
      into v_user_id
      from public.lookup_login_identity(p_identifier, p_role, p_dob) lli
     limit 1;

    if v_user_id is null then
        return false;
    end if;

    select usa.answer_hash
      into v_stored_hash
      from public.user_security_answers usa
     where usa.user_id = v_user_id
       and usa.security_question_id = p_question_id;

    if v_stored_hash is null then
        return false;
    end if;

    return v_stored_hash = encode(extensions.digest(lower(trim(coalesce(p_answer, ''))), 'sha256'), 'hex');
end;
$$;

-- Authenticated profile bundle
create or replace function public.get_my_profile_bundle()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select jsonb_build_object(
        'id', p.id,
        'role', p.role,
        'username', p.username,
        'email', p.email,
        'displayName', p.display_name,
        'avatarUrl', p.avatar_url,
        'patientCode', pp.patient_code,
        'workerId', hw.license_number,
        'adminId', ap.admin_code,
        'surname', coalesce(pp.surname, hw.surname),
        'firstname', coalesce(pp.firstname, hw.firstname),
        'middlename', coalesce(pp.middlename, hw.middlename),
        'dob', coalesce(pp.dob, hw.dob),
        'contactNumber', pp.contact_number,
        'addressId', pp.address_id,
        'pinCode', ap.pin_code
    )
    from public.profiles p
    left join public.patient_profiles pp on pp.user_id = p.id
    left join public.health_worker_profiles hw on hw.user_id = p.id
    left join public.admin_profiles ap on ap.user_id = p.id
    where p.id = auth.uid();
$$;

-- Patient booking RPC
create or replace function public.book_appointment(
    p_scheduled_date date,
    p_time_slot text,
    p_symptom_names text[] default null,
    p_other_symptom text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_patient_code text;
    v_appointment_id uuid;
    v_symptom_name text;
    v_symptom_id smallint;
begin
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    if public.current_user_role() <> 'patient'::public.app_role then
        raise exception 'Only patient accounts can book an appointment';
    end if;

    select patient_code
      into v_patient_code
      from public.patient_profiles
     where user_id = auth.uid();

    if v_patient_code is null then
        raise exception 'Patient profile not found';
    end if;

    insert into public.appointments (
        patient_user_id,
        booked_by_user_id,
        scheduled_date,
        time_slot,
        qr_value,
        other_symptom_text
    )
    values (
        auth.uid(),
        auth.uid(),
        p_scheduled_date,
        p_time_slot,
        v_patient_code,
        p_other_symptom
    )
    returning id into v_appointment_id;

    if p_symptom_names is not null then
        foreach v_symptom_name in array p_symptom_names loop
            insert into public.symptoms (name)
            values (v_symptom_name)
            on conflict (name) do nothing;

            select id
              into v_symptom_id
              from public.symptoms
             where name = v_symptom_name;

            if v_symptom_id is not null then
                insert into public.appointment_symptoms (appointment_id, symptom_id)
                values (v_appointment_id, v_symptom_id)
                on conflict (appointment_id, symptom_id) do nothing;
            end if;
        end loop;
    end if;

    return v_appointment_id;
end;
$$;

-- Consultation completion RPC
create or replace function public.complete_consultation(
    p_appointment_id uuid,
    p_diagnosis text,
    p_note text,
    p_started_at timestamptz,
    p_completed_at timestamptz,
    p_proof_image_url text,
    p_medicine_item_id uuid,
    p_medicine_quantity integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_consultation_id uuid;
    v_patient_user_id uuid;
    v_duration integer;
    v_message_id uuid;
begin
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    if public.current_user_role() not in ('health_worker'::public.app_role, 'admin'::public.app_role) then
        raise exception 'Only health workers or admins can complete consultations';
    end if;

    if p_medicine_quantity <= 0 then
        raise exception 'Medicine quantity must be greater than zero';
    end if;

    select patient_user_id
      into v_patient_user_id
      from public.appointments
     where id = p_appointment_id;

    if v_patient_user_id is null then
        raise exception 'Appointment not found';
    end if;

    v_duration := greatest(1, extract(epoch from (p_completed_at - p_started_at))::integer);

    insert into public.consultations (
        appointment_id,
        patient_user_id,
        health_worker_user_id,
        diagnosis,
        note,
        started_at,
        completed_at,
        duration_seconds,
        proof_image_url
    )
    values (
        p_appointment_id,
        v_patient_user_id,
        auth.uid(),
        p_diagnosis,
        p_note,
        p_started_at,
        p_completed_at,
        v_duration,
        p_proof_image_url
    )
    returning id into v_consultation_id;

    insert into public.consultation_items (consultation_id, item_id, quantity)
    values (v_consultation_id, p_medicine_item_id, p_medicine_quantity);

    insert into public.inventory_movements (
        item_id,
        moved_by_user_id,
        movement_type,
        quantity,
        consultation_id,
        note
    )
    values (
        p_medicine_item_id,
        auth.uid(),
        'dispense',
        p_medicine_quantity,
        v_consultation_id,
        'Medicine dispensed to patient'
    );

    insert into public.messages (
        sender_user_id,
        subject,
        body,
        message_type,
        appointment_id
    )
    values (
        auth.uid(),
        'Consultation Completed',
        'Your consultation has been completed and your prescription has been recorded.',
        'consultation_update',
        p_appointment_id
    )
    returning id into v_message_id;

    insert into public.message_recipients (message_id, recipient_user_id)
    values (v_message_id, v_patient_user_id);

    return v_consultation_id;
end;
$$;

-- Messaging helper RPC
create or replace function public.create_inbox_message(
    p_recipient_user_id uuid,
    p_subject text,
    p_body text,
    p_message_type text default 'notification',
    p_appointment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_message_id uuid;
begin
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    if public.current_user_role() not in ('health_worker'::public.app_role, 'admin'::public.app_role)
       and auth.uid() <> p_recipient_user_id then
        raise exception 'Not allowed to create this message';
    end if;

    insert into public.messages (
        sender_user_id,
        subject,
        body,
        message_type,
        appointment_id
    )
    values (
        auth.uid(),
        p_subject,
        p_body,
        p_message_type,
        p_appointment_id
    )
    returning id into v_message_id;

    insert into public.message_recipients (message_id, recipient_user_id)
    values (v_message_id, p_recipient_user_id);

    return v_message_id;
end;
$$;

create or replace function public.notify_admin_password_change(
    p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_message_id uuid;
    v_identifier text;
    v_role public.app_role;
    v_timestamp text;
    v_body text;
begin
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    select role into v_role
      from public.profiles
     where id = auth.uid();

    if v_role = 'patient'::public.app_role then
        select patient_code
          into v_identifier
          from public.patient_profiles
         where user_id = auth.uid();
    elsif v_role = 'health_worker'::public.app_role then
        select license_number
          into v_identifier
          from public.health_worker_profiles
         where user_id = auth.uid();
    else
        select admin_code
          into v_identifier
          from public.admin_profiles
         where user_id = auth.uid();
    end if;

    v_timestamp := to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
    v_body := coalesce(v_identifier, 'UNKNOWN-USER') || ' change its password at ' || v_timestamp;

    if coalesce(trim(p_reason), '') <> '' then
        v_body := v_body || '. Reason: ' || trim(p_reason);
    end if;

    insert into public.messages (
        sender_user_id,
        subject,
        body,
        message_type
    )
    values (
        auth.uid(),
        'Password Change Notification',
        v_body,
        'password_change'
    )
    returning id into v_message_id;

    insert into public.message_recipients (message_id, recipient_user_id)
    select v_message_id, ap.user_id
      from public.admin_profiles ap
    on conflict (message_id, recipient_user_id) do nothing;

    return v_message_id;
end;
$$;

create or replace function public.get_my_inbox_messages()
returns table (
    id uuid,
    subject text,
    body text,
    message_type text,
    created_at timestamptz,
    sender_user_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
    select
        m.id,
        m.subject,
        m.body,
        m.message_type,
        m.created_at,
        m.sender_user_id
    from public.message_recipients mr
    join public.messages m
      on m.id = mr.message_id
    where mr.recipient_user_id = auth.uid()
    order by m.created_at desc;
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.patient_profiles enable row level security;
alter table public.health_worker_profiles enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.security_questions enable row level security;
alter table public.user_security_answers enable row level security;
alter table public.symptoms enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_symptoms enable row level security;
alter table public.consultations enable row level security;
alter table public.consultation_items enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_balances enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.messages enable row level security;
alter table public.message_recipients enable row level security;

alter table public.profiles force row level security;
alter table public.addresses force row level security;
alter table public.patient_profiles force row level security;
alter table public.health_worker_profiles force row level security;
alter table public.admin_profiles force row level security;
alter table public.security_questions force row level security;
alter table public.user_security_answers force row level security;
alter table public.symptoms force row level security;
alter table public.appointments force row level security;
alter table public.appointment_symptoms force row level security;
alter table public.consultations force row level security;
alter table public.consultation_items force row level security;
alter table public.inventory_items force row level security;
alter table public.inventory_balances force row level security;
alter table public.inventory_movements force row level security;
alter table public.messages force row level security;
alter table public.message_recipients force row level security;

-- Profiles
DROP POLICY IF EXISTS profiles_select_policy ON public.profiles;
create policy profiles_select_policy
on public.profiles
for select
using (
    id = auth.uid()
    or public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role)
);

DROP POLICY IF EXISTS profiles_update_policy ON public.profiles;
create policy profiles_update_policy
on public.profiles
for update
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- Addresses
DROP POLICY IF EXISTS addresses_select_policy ON public.addresses;
create policy addresses_select_policy
on public.addresses
for select
using (
    public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role)
    or exists (
        select 1
          from public.patient_profiles pp
         where pp.address_id = addresses.id
           and pp.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS addresses_write_policy ON public.addresses;
create policy addresses_write_policy
on public.addresses
for all
using (
    public.is_admin()
    or exists (
        select 1
          from public.patient_profiles pp
         where pp.address_id = addresses.id
           and pp.user_id = auth.uid()
    )
)
with check (
    public.is_admin()
    or true
);

-- Role profiles
DROP POLICY IF EXISTS patient_profiles_select_policy ON public.patient_profiles;
create policy patient_profiles_select_policy
on public.patient_profiles
for select
using (
    user_id = auth.uid()
    or public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role)
);

DROP POLICY IF EXISTS patient_profiles_update_policy ON public.patient_profiles;
create policy patient_profiles_update_policy
on public.patient_profiles
for update
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

DROP POLICY IF EXISTS health_worker_profiles_select_policy ON public.health_worker_profiles;
create policy health_worker_profiles_select_policy
on public.health_worker_profiles
for select
using (user_id = auth.uid() or public.is_admin());

DROP POLICY IF EXISTS health_worker_profiles_update_policy ON public.health_worker_profiles;
create policy health_worker_profiles_update_policy
on public.health_worker_profiles
for update
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

DROP POLICY IF EXISTS admin_profiles_select_policy ON public.admin_profiles;
create policy admin_profiles_select_policy
on public.admin_profiles
for select
using (user_id = auth.uid() or public.is_admin());

DROP POLICY IF EXISTS admin_profiles_update_policy ON public.admin_profiles;
create policy admin_profiles_update_policy
on public.admin_profiles
for update
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

-- Security lookups
DROP POLICY IF EXISTS security_questions_read_policy ON public.security_questions;
create policy security_questions_read_policy
on public.security_questions
for select
using (true);

DROP POLICY IF EXISTS user_security_answers_read_policy ON public.user_security_answers;
create policy user_security_answers_read_policy
on public.user_security_answers
for select
using (user_id = auth.uid() or public.is_admin());

DROP POLICY IF EXISTS user_security_answers_write_policy ON public.user_security_answers;
create policy user_security_answers_write_policy
on public.user_security_answers
for all
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

DROP POLICY IF EXISTS symptoms_read_policy ON public.symptoms;
create policy symptoms_read_policy
on public.symptoms
for select
using (true);

-- Appointments
DROP POLICY IF EXISTS appointments_select_policy ON public.appointments;
create policy appointments_select_policy
on public.appointments
for select
using (
    patient_user_id = auth.uid()
    or public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role)
);

DROP POLICY IF EXISTS appointments_insert_policy ON public.appointments;
create policy appointments_insert_policy
on public.appointments
for insert
with check (
    (patient_user_id = auth.uid() and booked_by_user_id = auth.uid())
    or public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role)
);

DROP POLICY IF EXISTS appointments_update_policy ON public.appointments;
create policy appointments_update_policy
on public.appointments
for update
using (
    patient_user_id = auth.uid()
    or public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role)
)
with check (
    patient_user_id = auth.uid()
    or public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role)
);

DROP POLICY IF EXISTS appointments_delete_policy ON public.appointments;
create policy appointments_delete_policy
on public.appointments
for delete
using (
    (patient_user_id = auth.uid() and status = 'booked'::public.appointment_status)
    or public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role)
);

DROP POLICY IF EXISTS appointment_symptoms_select_policy ON public.appointment_symptoms;
create policy appointment_symptoms_select_policy
on public.appointment_symptoms
for select
using (
    exists (
        select 1
          from public.appointments a
         where a.id = appointment_symptoms.appointment_id
           and (
               a.patient_user_id = auth.uid()
               or public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role)
           )
    )
);

DROP POLICY IF EXISTS appointment_symptoms_write_policy ON public.appointment_symptoms;
create policy appointment_symptoms_write_policy
on public.appointment_symptoms
for all
using (
    exists (
        select 1
          from public.appointments a
         where a.id = appointment_symptoms.appointment_id
           and (
               a.patient_user_id = auth.uid()
               or public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role)
           )
    )
)
with check (
    exists (
        select 1
          from public.appointments a
         where a.id = appointment_symptoms.appointment_id
           and (
               a.patient_user_id = auth.uid()
               or public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role)
           )
    )
);

-- Consultations
DROP POLICY IF EXISTS consultations_select_policy ON public.consultations;
create policy consultations_select_policy
on public.consultations
for select
using (
    patient_user_id = auth.uid()
    or public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role)
);

DROP POLICY IF EXISTS consultations_insert_policy ON public.consultations;
create policy consultations_insert_policy
on public.consultations
for insert
with check (
    (
        public.current_user_role() = 'health_worker'::public.app_role
        and health_worker_user_id = auth.uid()
    )
    or public.current_user_role() = 'admin'::public.app_role
);

DROP POLICY IF EXISTS consultations_update_policy ON public.consultations;
create policy consultations_update_policy
on public.consultations
for update
using (
    (health_worker_user_id = auth.uid() and public.current_user_role() = 'health_worker'::public.app_role)
    or public.current_user_role() = 'admin'::public.app_role
)
with check (
    (health_worker_user_id = auth.uid() and public.current_user_role() = 'health_worker'::public.app_role)
    or public.current_user_role() = 'admin'::public.app_role
);

DROP POLICY IF EXISTS consultations_delete_policy ON public.consultations;
create policy consultations_delete_policy
on public.consultations
for delete
using (public.current_user_role() = 'admin'::public.app_role);

DROP POLICY IF EXISTS consultation_items_select_policy ON public.consultation_items;
create policy consultation_items_select_policy
on public.consultation_items
for select
using (
    exists (
        select 1
          from public.consultations c
         where c.id = consultation_items.consultation_id
           and (
               c.patient_user_id = auth.uid()
               or public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role)
           )
    )
);

DROP POLICY IF EXISTS consultation_items_write_policy ON public.consultation_items;
create policy consultation_items_write_policy
on public.consultation_items
for all
using (
    exists (
        select 1
          from public.consultations c
         where c.id = consultation_items.consultation_id
           and (
               c.health_worker_user_id = auth.uid()
               or public.current_user_role() = 'admin'::public.app_role
           )
    )
)
with check (
    exists (
        select 1
          from public.consultations c
         where c.id = consultation_items.consultation_id
           and (
               c.health_worker_user_id = auth.uid()
               or public.current_user_role() = 'admin'::public.app_role
           )
    )
);

-- Inventory
DROP POLICY IF EXISTS inventory_items_select_policy ON public.inventory_items;
create policy inventory_items_select_policy
on public.inventory_items
for select
using (public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role));

DROP POLICY IF EXISTS inventory_items_write_policy ON public.inventory_items;
create policy inventory_items_write_policy
on public.inventory_items
for all
using (public.current_user_role() = 'admin'::public.app_role)
with check (public.current_user_role() = 'admin'::public.app_role);

DROP POLICY IF EXISTS inventory_balances_select_policy ON public.inventory_balances;
create policy inventory_balances_select_policy
on public.inventory_balances
for select
using (public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role));

DROP POLICY IF EXISTS inventory_movements_select_policy ON public.inventory_movements;
create policy inventory_movements_select_policy
on public.inventory_movements
for select
using (public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role));

DROP POLICY IF EXISTS inventory_movements_insert_policy ON public.inventory_movements;
create policy inventory_movements_insert_policy
on public.inventory_movements
for insert
with check (
    (
        public.current_user_role() = 'health_worker'::public.app_role
        and moved_by_user_id = auth.uid()
    )
    or public.current_user_role() = 'admin'::public.app_role
);

DROP POLICY IF EXISTS inventory_movements_update_policy ON public.inventory_movements;
create policy inventory_movements_update_policy
on public.inventory_movements
for update
using (public.current_user_role() = 'admin'::public.app_role)
with check (public.current_user_role() = 'admin'::public.app_role);

DROP POLICY IF EXISTS inventory_movements_delete_policy ON public.inventory_movements;
create policy inventory_movements_delete_policy
on public.inventory_movements
for delete
using (public.current_user_role() = 'admin'::public.app_role);

-- Messaging
DROP POLICY IF EXISTS messages_select_policy ON public.messages;
create policy messages_select_policy
on public.messages
for select
using (
    sender_user_id = auth.uid()
    or public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role)
    or exists (
        select 1
          from public.message_recipients mr
         where mr.message_id = messages.id
           and mr.recipient_user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS messages_insert_policy ON public.messages;
create policy messages_insert_policy
on public.messages
for insert
with check (
    sender_user_id = auth.uid()
    or public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role)
);

DROP POLICY IF EXISTS messages_update_policy ON public.messages;
create policy messages_update_policy
on public.messages
for update
using (
    sender_user_id = auth.uid()
    or public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role)
)
with check (
    sender_user_id = auth.uid()
    or public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role)
);

DROP POLICY IF EXISTS messages_delete_policy ON public.messages;
create policy messages_delete_policy
on public.messages
for delete
using (
    sender_user_id = auth.uid()
    or public.current_user_role() = 'admin'::public.app_role
);

DROP POLICY IF EXISTS message_recipients_select_policy ON public.message_recipients;
create policy message_recipients_select_policy
on public.message_recipients
for select
using (
    recipient_user_id = auth.uid()
    or public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role)
);

DROP POLICY IF EXISTS message_recipients_insert_policy ON public.message_recipients;
create policy message_recipients_insert_policy
on public.message_recipients
for insert
with check (
    public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role)
    or recipient_user_id = auth.uid()
);

DROP POLICY IF EXISTS message_recipients_update_policy ON public.message_recipients;
create policy message_recipients_update_policy
on public.message_recipients
for update
using (recipient_user_id = auth.uid() or public.current_user_role() = 'admin'::public.app_role)
with check (recipient_user_id = auth.uid() or public.current_user_role() = 'admin'::public.app_role);

DROP POLICY IF EXISTS message_recipients_delete_policy ON public.message_recipients;
create policy message_recipients_delete_policy
on public.message_recipients
for delete
using (public.current_user_role() = 'admin'::public.app_role);

-- Analytics views
create or replace view public.v_daily_consultation_attendance
with (security_invoker = true)
as
with booked as (
    select
        a.scheduled_date as consultation_date,
        count(*) as booked_count
    from public.appointments a
    where a.status in ('booked'::public.appointment_status, 'consulted'::public.appointment_status, 'no_show'::public.appointment_status, 'cancelled'::public.appointment_status)
    group by a.scheduled_date
),
attended as (
    select
        a.scheduled_date as consultation_date,
        count(*) as attended_count
    from public.consultations c
    join public.appointments a on a.id = c.appointment_id
    group by a.scheduled_date
)
select
    coalesce(b.consultation_date, t.consultation_date) as consultation_date,
    coalesce(b.booked_count, 0) as booked_count,
    coalesce(t.attended_count, 0) as attended_count,
    greatest(coalesce(b.booked_count, 0) - coalesce(t.attended_count, 0), 0) as absence_count
from booked b
full join attended t
  on t.consultation_date = b.consultation_date
order by consultation_date desc;

create or replace view public.v_top_diagnosis_by_age_group
with (security_invoker = true)
as
with diagnosed as (
    select
        c.diagnosis,
        case
            when pp.dob is null then 'Unknown age'
            when extract(year from age(current_date, pp.dob)) between 0 and 2 then 'Infants (0-2)'
            when extract(year from age(current_date, pp.dob)) between 3 and 12 then 'Children (3-12)'
            when extract(year from age(current_date, pp.dob)) between 13 and 17 then 'Adolescents (13-17)'
            when extract(year from age(current_date, pp.dob)) between 18 and 59 then 'Adults (18-59)'
            when extract(year from age(current_date, pp.dob)) >= 60 then 'Seniors (60+)'
            else 'Unknown age'
        end as age_group
    from public.consultations c
    join public.patient_profiles pp on pp.user_id = c.patient_user_id
),
ranked as (
    select
        d.age_group,
        d.diagnosis,
        count(*) as case_count,
        row_number() over (
            partition by d.age_group
            order by count(*) desc, d.diagnosis asc
        ) as row_num
    from diagnosed d
    group by d.age_group, d.diagnosis
)
select
    age_group,
    diagnosis,
    case_count
from ranked
where row_num = 1;

-- Seed lookup and starter inventory data
insert into public.security_questions (question_text)
values
    ('Name of your cat'),
    ('Favorite actor/actress'),
    ('Favorite food'),
    ('Name of your first school'),
    ('Your childhood nickname')
on conflict (question_text) do nothing;

insert into public.symptoms (name)
values
    ('Fever'),
    ('Cough'),
    ('Colds'),
    ('Headache'),
    ('Sore throat'),
    ('Body pain'),
    ('Stomach ache'),
    ('Diarrhea'),
    ('Dizziness'),
    ('Others')
on conflict (name) do nothing;

insert into public.inventory_items (name, category, unit)
values
    ('Paracetamol', 'medicine', 'tablets'),
    ('Ibuprofen', 'medicine', 'tablets'),
    ('Loperamide', 'medicine', 'capsules'),
    ('Amoxicillin', 'medicine', 'capsules'),
    ('Walking Cane', 'aid', 'pcs'),
    ('Walker', 'aid', 'pcs'),
    ('Wheelchair', 'aid', 'pcs')
on conflict (name, category) do nothing;

insert into public.inventory_balances (item_id, quantity)
select
    ii.id,
    case ii.name::text
        when 'Paracetamol' then 120
        when 'Ibuprofen' then 90
        when 'Loperamide' then 75
        when 'Amoxicillin' then 60
        when 'Walking Cane' then 18
        when 'Walker' then 10
        when 'Wheelchair' then 6
        else 0
    end as quantity
from public.inventory_items ii
on conflict (item_id) do nothing;

-- Grants
grant execute on function public.lookup_login_identity(text, public.app_role, date) to anon, authenticated;
grant execute on function public.verify_security_answer(text, public.app_role, smallint, text, date) to anon, authenticated;
grant execute on function public.get_my_profile_bundle() to authenticated;
grant execute on function public.book_appointment(date, text, text[], text) to authenticated;
grant execute on function public.complete_consultation(uuid, text, text, timestamptz, timestamptz, text, uuid, integer) to authenticated;
grant execute on function public.create_inbox_message(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.notify_admin_password_change(text) to authenticated;
grant execute on function public.get_my_inbox_messages() to authenticated;

grant select on public.security_questions to anon, authenticated;
grant select on public.symptoms to anon, authenticated;
grant select on public.v_daily_consultation_attendance to authenticated;
grant select on public.v_top_diagnosis_by_age_group to authenticated;

commit;
