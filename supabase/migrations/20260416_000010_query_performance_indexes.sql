begin;

-- Supports newest-first pagination of appointment and consultation feeds.
create index if not exists idx_appointments_created_at_desc
  on public.appointments (created_at desc);

create index if not exists idx_consultations_created_at_desc
  on public.consultations (created_at desc);

-- Supports admin health worker directory sorted by created timestamp.
create index if not exists idx_health_worker_profiles_created_at_desc
  on public.health_worker_profiles (created_at desc);

-- Supports dispense history lookups filtered by movement type + consultation list.
create index if not exists idx_inventory_movements_type_consult_created_desc
  on public.inventory_movements (movement_type, consultation_id, created_at desc);

commit;
