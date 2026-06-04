begin;

alter table public.consultation_items
  add column if not exists medicine_intake_per_day integer;

alter table public.consultation_items
  add column if not exists medicine_intake_instruction text;

update public.consultation_items
set medicine_intake_per_day = case
    when medicine_intake_per_day is not null then medicine_intake_per_day
    when medicine_intake_frequency = '1x' then 1
    when medicine_intake_frequency = '2x' then 2
    when medicine_intake_frequency = '3x' then 3
    when medicine_intake_frequency = 'more_than_3x' then 4
    else 1
end;

update public.consultation_items
set medicine_intake_instruction = coalesce(medicine_intake_instruction, medicine_intake_more_than_3x_note)
where medicine_intake_instruction is null;

alter table public.consultation_items
  alter column medicine_intake_per_day set default 1;

alter table public.consultation_items
  alter column medicine_intake_per_day set not null;

alter table public.consultation_items
  drop constraint if exists consultation_items_medicine_intake_per_day_chk;

alter table public.consultation_items
  add constraint consultation_items_medicine_intake_per_day_chk
  check (medicine_intake_per_day > 0);

create or replace function public.complete_consultation(
    p_appointment_id uuid,
    p_diagnosis text,
    p_note text,
    p_started_at timestamptz,
    p_completed_at timestamptz,
    p_proof_image_url text,
    p_medicine_item_id uuid,
    p_medicine_quantity integer,
    p_medicine_intake_per_day integer default 1,
    p_medicine_intake_instruction text default null
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
    v_intake_per_day integer;
    v_intake_instruction text;
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

    v_intake_per_day := greatest(1, coalesce(p_medicine_intake_per_day, 1));
    v_intake_instruction := nullif(trim(coalesce(p_medicine_intake_instruction, '')), '');

    if v_intake_per_day > 3 and v_intake_instruction is null then
        raise exception 'Please provide medicine intake instruction for more than 3x/day';
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

    insert into public.consultation_items (
        consultation_id,
        item_id,
        quantity,
        medicine_intake_per_day,
        medicine_intake_instruction,
        medicine_intake_frequency,
        medicine_intake_more_than_3x_note
    )
    values (
        v_consultation_id,
        p_medicine_item_id,
        p_medicine_quantity,
        v_intake_per_day,
        v_intake_instruction,
        case
            when v_intake_per_day = 1 then '1x'
            when v_intake_per_day = 2 then '2x'
            when v_intake_per_day = 3 then '3x'
            else 'more_than_3x'
        end,
        case when v_intake_per_day > 3 then v_intake_instruction else null end
    );

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

commit;
