begin;

alter table public.consultation_items
  add column if not exists medicine_intake_frequency text;

alter table public.consultation_items
  add column if not exists medicine_intake_more_than_3x_note text;

update public.consultation_items
set medicine_intake_frequency = coalesce(medicine_intake_frequency, '1x')
where medicine_intake_frequency is null;

alter table public.consultation_items
  alter column medicine_intake_frequency set default '1x';

alter table public.consultation_items
  alter column medicine_intake_frequency set not null;

alter table public.consultation_items
  drop constraint if exists consultation_items_medicine_intake_frequency_chk;

alter table public.consultation_items
  add constraint consultation_items_medicine_intake_frequency_chk
  check (medicine_intake_frequency in ('1x', '2x', '3x', 'more_than_3x'));

create or replace function public.complete_consultation(
    p_appointment_id uuid,
    p_diagnosis text,
    p_note text,
    p_started_at timestamptz,
    p_completed_at timestamptz,
    p_proof_image_url text,
    p_medicine_item_id uuid,
    p_medicine_quantity integer,
    p_medicine_intake_frequency text default '1x',
    p_medicine_intake_more_than_3x_note text default null
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
    v_intake_frequency text;
    v_more_than_3x_note text;
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

    v_intake_frequency := coalesce(nullif(trim(p_medicine_intake_frequency), ''), '1x');
    v_more_than_3x_note := nullif(trim(coalesce(p_medicine_intake_more_than_3x_note, '')), '');

    if v_intake_frequency not in ('1x', '2x', '3x', 'more_than_3x') then
        raise exception 'Invalid medicine intake frequency';
    end if;

    if v_intake_frequency = 'more_than_3x' and v_more_than_3x_note is null then
        raise exception 'Please provide medicine intake instruction for more than 3x';
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
        medicine_intake_frequency,
        medicine_intake_more_than_3x_note
    )
    values (
        v_consultation_id,
        p_medicine_item_id,
        p_medicine_quantity,
        v_intake_frequency,
        v_more_than_3x_note
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
