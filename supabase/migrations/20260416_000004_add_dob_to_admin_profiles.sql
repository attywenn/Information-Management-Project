-- Add dob column to admin_profiles table

alter table public.admin_profiles
add column if not exists dob date;

-- Update the get_my_profile_bundle function to include admin DOB
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
        'dob', coalesce(pp.dob, hw.dob, ap.dob),
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
