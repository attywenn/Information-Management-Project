alter table public.patient_profiles
add column if not exists sex text,
add column if not exists gender text;

alter table public.health_worker_profiles
add column if not exists sex text,
add column if not exists gender text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'patient_profiles_sex_chk'
  ) then
    alter table public.patient_profiles
      add constraint patient_profiles_sex_chk
      check (sex in ('Male', 'Female', 'Prefer not to say') or sex is null);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'health_worker_profiles_sex_chk'
  ) then
    alter table public.health_worker_profiles
      add constraint health_worker_profiles_sex_chk
      check (sex in ('Male', 'Female', 'Prefer not to say') or sex is null);
  end if;
end $$;

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
            sex,
            gender,
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
            nullif(metadata->>'sex', ''),
            nullif(metadata->>'gender', ''),
            nullif(metadata->>'contact_number', ''),
            address_row_id
        )
        on conflict (user_id) do update
           set patient_code = excluded.patient_code,
               surname = excluded.surname,
               firstname = excluded.firstname,
               middlename = excluded.middlename,
               dob = excluded.dob,
               sex = excluded.sex,
               gender = excluded.gender,
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
            dob,
            sex,
            gender
        )
        values (
            new.id,
            coalesce(nullif(metadata->>'license_number', ''), public.generate_health_worker_license()),
            coalesce(nullif(metadata->>'surname', ''), 'N/A'),
            coalesce(nullif(metadata->>'firstname', ''), resolved_username),
            nullif(metadata->>'middlename', ''),
            case when coalesce(nullif(metadata->>'dob', ''), '') <> '' then (metadata->>'dob')::date else null end,
            nullif(metadata->>'sex', ''),
            nullif(metadata->>'gender', '')
        )
        on conflict (user_id) do update
           set license_number = excluded.license_number,
               surname = excluded.surname,
               firstname = excluded.firstname,
               middlename = excluded.middlename,
               dob = excluded.dob,
               sex = excluded.sex,
               gender = excluded.gender,
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

        insert into public.user_security_answers (user_id, security_question_id, answer_hash, updated_at)
        values (
            new.id,
            question_id,
            encode(extensions.digest(answer_text || ':' || new.id::text, 'sha256'), 'hex'),
            timezone('utc', now())
        )
        on conflict (user_id) do update
           set security_question_id = excluded.security_question_id,
               answer_hash = excluded.answer_hash,
               updated_at = excluded.updated_at;
    end if;

    return new;
end;
$$;

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
        'lastAvatarUpdatedAt', p.last_avatar_updated_at,
        'patientCode', pp.patient_code,
        'workerId', hw.license_number,
        'adminId', ap.admin_code,
        'surname', coalesce(pp.surname, hw.surname),
        'firstname', coalesce(pp.firstname, hw.firstname),
        'middlename', coalesce(pp.middlename, hw.middlename),
        'dob', coalesce(pp.dob, hw.dob),
        'sex', coalesce(pp.sex, hw.sex),
        'gender', coalesce(pp.gender, hw.gender),
        'contactNumber', pp.contact_number,
        'addressId', coalesce(pp.address_id, hw.address_id),
        'lastAddressUpdatedAt', coalesce(pp.last_address_updated_at, hw.last_address_updated_at),
        'pinCode', ap.pin_code
    )
    from public.profiles p
    left join public.patient_profiles pp on pp.user_id = p.id
    left join public.health_worker_profiles hw on hw.user_id = p.id
    left join public.admin_profiles ap on ap.user_id = p.id
    where p.id = auth.uid();
$$;
