alter table public.health_worker_profiles
add column if not exists address_id bigint references public.addresses (id) on delete set null;

create index if not exists idx_health_worker_profiles_address_id
  on public.health_worker_profiles (address_id);

create or replace function public.resolve_address_id(
    p_region text,
    p_province text,
    p_city text,
    p_barangay text,
    p_house_number text,
    p_street text,
    p_purok_subdivision text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
    v_region text := coalesce(nullif(trim(p_region), ''), 'NCR');
    v_province text := coalesce(nullif(trim(p_province), ''), 'METRO MANILA');
    v_city text := coalesce(nullif(trim(p_city), ''), 'SAN JUAN CITY');
    v_barangay text := coalesce(nullif(trim(p_barangay), ''), 'BARANGAY SAN PERFECTO');
    v_house text := coalesce(nullif(trim(p_house_number), ''), '');
    v_street text := coalesce(nullif(trim(p_street), ''), '');
    v_purok text := coalesce(nullif(trim(p_purok_subdivision), ''), '');
    v_address_id bigint;
begin
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

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
        v_region,
        v_province,
        v_city,
        v_barangay,
        v_house,
        v_street,
        v_purok
    )
    on conflict (region, province, city, barangay, house_number, street, purok_subdivision)
    do update
        set updated_at = timezone('utc', now())
    returning id into v_address_id;

    return v_address_id;
end;
$$;

grant execute on function public.resolve_address_id(text, text, text, text, text, text, text) to authenticated;

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
        'addressId', coalesce(pp.address_id, hw.address_id),
        'pinCode', ap.pin_code
    )
    from public.profiles p
    left join public.patient_profiles pp on pp.user_id = p.id
    left join public.health_worker_profiles hw on hw.user_id = p.id
    left join public.admin_profiles ap on ap.user_id = p.id
    where p.id = auth.uid();
$$;
