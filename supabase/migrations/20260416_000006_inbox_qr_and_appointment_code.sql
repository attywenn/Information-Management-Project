-- Ensure appointment booking notifications expose QR and appointment code in inbox feeds.
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
    v_message_id uuid;
    v_patient_name text;
begin
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    if public.current_user_role() <> 'patient'::public.app_role then
        raise exception 'Only patient accounts can book an appointment';
    end if;

    select patient_code, concat_ws(' ', firstname, surname)
      into v_patient_code, v_patient_name
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

    insert into public.messages (
        sender_user_id,
        subject,
        body,
        message_type,
        appointment_id
    )
    values (
        auth.uid(),
        'Appointment Booked',
        format(
            'Hello %s, your appointment for %s at %s has been saved. Appointment code: %s. QR code: %s',
            coalesce(nullif(v_patient_name, ''), 'patient'),
            to_char(p_scheduled_date, 'YYYY-MM-DD'),
            p_time_slot,
            v_appointment_id,
            v_qr_value
        ),
        'appointment_update',
        v_appointment_id
    )
    returning id into v_message_id;

    insert into public.message_recipients (message_id, recipient_user_id)
    values (v_message_id, auth.uid());

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

drop function if exists public.get_my_inbox_messages();

create function public.get_my_inbox_messages()
returns table (
    id uuid,
    subject text,
    body text,
    message_type text,
    created_at timestamptz,
    sender_user_id uuid,
    appointment_id uuid,
    qr_value text
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
        m.sender_user_id,
        m.appointment_id,
        a.qr_value
    from public.message_recipients mr
    join public.messages m
      on m.id = mr.message_id
    left join public.appointments a
      on a.id = m.appointment_id
    where mr.recipient_user_id = auth.uid()
    order by m.created_at desc;
$$;

grant execute on function public.get_my_inbox_messages() to authenticated;
