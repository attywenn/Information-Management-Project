-- Allow patients to resolve medicine and attending health worker names
-- only for consultations that belong to their own account.

drop policy if exists health_worker_profiles_select_policy on public.health_worker_profiles;
create policy health_worker_profiles_select_policy
on public.health_worker_profiles
for select
using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
        select 1
          from public.consultations c
         where c.health_worker_user_id = health_worker_profiles.user_id
           and c.patient_user_id = auth.uid()
    )
);

drop policy if exists inventory_items_select_policy on public.inventory_items;
create policy inventory_items_select_policy
on public.inventory_items
for select
using (
    public.current_user_role() in ('health_worker'::public.app_role, 'admin'::public.app_role)
    or exists (
        select 1
          from public.consultation_items ci
          join public.consultations c on c.id = ci.consultation_id
         where ci.item_id = inventory_items.id
           and c.patient_user_id = auth.uid()
    )
);
