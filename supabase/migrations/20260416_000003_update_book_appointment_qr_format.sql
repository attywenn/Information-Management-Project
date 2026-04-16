-- Update appointment QR formatting so the patient segment and random segment are explicit.
create or replace function public.book_appointment(
    p_scheduled_date date,
    p_time_slot text,
    p_symptom_names text[] default null,
    p_other_symptom text default null,
    p_qr_value text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_patient_code text;
    v_patient_segment text;
    v_appointment_id uuid;
    v_symptom_name text;
    v_symptom_id smallint;
    v_qr_value text;
    v_constraint_name text;
    v_attempt integer := 0;
    v_provided_qr_value text := nullif(btrim(p_qr_value), '');
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

    v_patient_segment := 'PA' || lpad(right(regexp_replace(v_patient_code, '\D', '', 'g'), 4), 4, '0');

    if v_provided_qr_value is not null then
        v_qr_value := v_provided_qr_value;

        begin
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
                v_qr_value,
                p_other_symptom
            )
            returning id into v_appointment_id;
        exception
            when unique_violation then
                get stacked diagnostics v_constraint_name = CONSTRAINT_NAME;

                if v_constraint_name = 'appointments_qr_value_key' then
                    raise exception 'Duplicate appointment QR value';
                end if;

                raise;
        end;
    else
        loop
            v_attempt := v_attempt + 1;

            if v_attempt > 8 then
                raise exception 'Unable to generate unique appointment QR value';
            end if;

            v_qr_value := format(
                '%s-%s',
                v_patient_segment,
                upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4))
            );

            begin
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
                    v_qr_value,
                    p_other_symptom
                )
                returning id into v_appointment_id;

                exit;
            exception
                when unique_violation then
                    get stacked diagnostics v_constraint_name = CONSTRAINT_NAME;

                    if v_constraint_name = 'appointments_qr_value_key' then
                        continue;
                    end if;

                    raise;
            end;
        end loop;
    end if;

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
