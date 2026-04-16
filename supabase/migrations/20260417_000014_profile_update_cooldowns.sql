alter table public.profiles
add column if not exists last_avatar_updated_at timestamptz;

alter table public.patient_profiles
add column if not exists last_address_updated_at timestamptz;

alter table public.health_worker_profiles
add column if not exists last_address_updated_at timestamptz;

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
