-- Keep inventory changes authoritative in Supabase, not in browser state.
create or replace function public.upsert_inventory_item(
    p_name text,
    p_category public.inventory_category,
    p_unit text,
    p_quantity integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_item_id uuid;
    v_name text := nullif(btrim(p_name), '');
    v_unit text := coalesce(nullif(btrim(p_unit), ''), 'pcs');
    v_quantity integer := coalesce(p_quantity, 0);
begin
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    if public.current_user_role() <> 'admin'::public.app_role then
        raise exception 'Only admins can manage inventory';
    end if;

    if v_name is null then
        raise exception 'Item name is required';
    end if;

    if v_quantity < 0 then
        raise exception 'Quantity must be zero or greater';
    end if;

    insert into public.inventory_items (name, category, unit)
    values (v_name, p_category, v_unit)
    on conflict (name, category) do update
       set unit = excluded.unit,
           updated_at = timezone('utc', now())
    returning id into v_item_id;

    if v_quantity > 0 then
        insert into public.inventory_movements (
            item_id,
            moved_by_user_id,
            movement_type,
            quantity,
            note
        )
        values (
            v_item_id,
            auth.uid(),
            'add',
            v_quantity,
            'Inventory stock updated by admin'
        );
    end if;

    return v_item_id;
end;
$$;

create or replace function public.adjust_inventory_quantity(
    p_item_id uuid,
    p_quantity integer,
    p_movement_type public.inventory_movement_type default 'add',
    p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_item_id uuid;
    v_quantity integer := coalesce(p_quantity, 0);
    v_note text := nullif(btrim(p_note), '');
begin
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    if public.current_user_role() <> 'admin'::public.app_role then
        raise exception 'Only admins can manage inventory';
    end if;

    if p_item_id is null then
        raise exception 'Inventory item is required';
    end if;

    if v_quantity <= 0 then
        raise exception 'Quantity must be greater than zero';
    end if;

    insert into public.inventory_movements (
        item_id,
        moved_by_user_id,
        movement_type,
        quantity,
        note
    )
    values (
        p_item_id,
        auth.uid(),
        p_movement_type,
        v_quantity,
        coalesce(v_note, case when p_movement_type = 'add' then 'Inventory stock added by admin' else 'Inventory stock reduced by admin' end)
    )
    returning item_id into v_item_id;

    return v_item_id;
end;
$$;

grant execute on function public.upsert_inventory_item(text, public.inventory_category, text, integer) to authenticated;
grant execute on function public.adjust_inventory_quantity(uuid, integer, public.inventory_movement_type, text) to authenticated;
