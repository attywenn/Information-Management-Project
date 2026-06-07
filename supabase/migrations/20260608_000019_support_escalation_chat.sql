begin;

alter table public.messages
    add column if not exists conversation_key text;

create index if not exists idx_messages_conversation_created_at_desc
    on public.messages (conversation_key, created_at desc);

drop function if exists public.get_support_chat_target();
create function public.get_support_chat_target()
returns table (
    user_id uuid,
    email citext,
    display_name text
)
language sql
stable
security definer
set search_path = public
as $$
    select
        p.id as user_id,
        p.email,
        p.display_name
    from public.profiles p
    where p.role = 'admin'::public.app_role
      and p.email = 'wnciplays@gmail.com'
    order by p.created_at asc
    limit 1;
$$;

grant execute on function public.get_support_chat_target() to authenticated;

drop function if exists public.create_support_message(uuid, text, text, text, text);
create function public.create_support_message(
    p_recipient_user_id uuid,
    p_subject text,
    p_body text,
    p_message_type text default 'support_chat',
    p_conversation_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_message_id uuid;
    v_conversation_key text;
    v_subject text := trim(coalesce(p_subject, ''));
    v_body text := trim(coalesce(p_body, ''));
    v_message_type text := nullif(trim(coalesce(p_message_type, 'support_chat')), '');
begin
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    if p_recipient_user_id is null then
        raise exception 'Recipient is required';
    end if;

    if v_subject = '' then
        raise exception 'Subject is required';
    end if;

    if v_body = '' then
        raise exception 'Message body is required';
    end if;

    if public.current_user_role() <> 'admin'::public.app_role then
        if not exists (
            select 1
              from public.admin_profiles ap
             where ap.user_id = p_recipient_user_id
        ) then
            raise exception 'Support chat can only be sent to the admin mailbox';
        end if;
    end if;

    v_conversation_key := nullif(trim(coalesce(p_conversation_key, '')), '');
    if v_conversation_key is null then
        v_conversation_key := format(
            'support:%s:%s',
            least(auth.uid()::text, p_recipient_user_id::text),
            greatest(auth.uid()::text, p_recipient_user_id::text)
        );
    end if;

    insert into public.messages (
        sender_user_id,
        subject,
        body,
        message_type,
        conversation_key
    )
    values (
        auth.uid(),
        v_subject,
        v_body,
        coalesce(v_message_type, 'support_chat'),
        v_conversation_key
    )
    returning id into v_message_id;

    insert into public.message_recipients (message_id, recipient_user_id)
    values (v_message_id, p_recipient_user_id);

    return v_message_id;
end;
$$;

grant execute on function public.create_support_message(uuid, text, text, text, text) to authenticated;

drop function if exists public.get_support_conversation_messages(text);
create function public.get_support_conversation_messages(
    p_conversation_key text
)
returns table (
    id uuid,
    sender_user_id uuid,
    sender_display_name text,
    sender_role text,
    subject text,
    body text,
    message_type text,
    conversation_key text,
    created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
    select
        m.id,
        m.sender_user_id,
        p.display_name as sender_display_name,
        p.role::text as sender_role,
        m.subject,
        m.body,
        m.message_type,
        m.conversation_key,
        m.created_at
    from public.messages m
    join public.profiles p
      on p.id = m.sender_user_id
    where m.conversation_key = p_conversation_key
      and (
          public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role)
          or m.sender_user_id = auth.uid()
          or exists (
              select 1
                from public.message_recipients mr
               where mr.message_id = m.id
                 and mr.recipient_user_id = auth.uid()
          )
      )
    order by m.created_at asc;
$$;

grant execute on function public.get_support_conversation_messages(text) to authenticated;

create or replace function public.get_my_inbox_messages()
returns table (
    id uuid,
    subject text,
    body text,
    message_type text,
    created_at timestamptz,
    sender_user_id uuid,
    appointment_id uuid,
    qr_value text,
    conversation_key text
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
        a.qr_value,
        m.conversation_key
    from public.message_recipients mr
    join public.messages m
      on m.id = mr.message_id
    left join public.appointments a
      on a.id = m.appointment_id
    where mr.recipient_user_id = auth.uid()
    order by m.created_at desc;
$$;

commit;