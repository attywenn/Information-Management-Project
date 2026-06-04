begin;

alter table public.appointments
  drop constraint if exists appointments_booked_by_user_id_fkey;
alter table public.appointments
  alter column booked_by_user_id drop not null;
alter table public.appointments
  add constraint appointments_booked_by_user_id_fkey
  foreign key (booked_by_user_id)
  references public.profiles (id)
  on delete set null;

alter table public.consultations
  drop constraint if exists consultations_patient_user_id_fkey;
alter table public.consultations
  alter column patient_user_id drop not null;
alter table public.consultations
  add constraint consultations_patient_user_id_fkey
  foreign key (patient_user_id)
  references public.patient_profiles (user_id)
  on delete set null;

alter table public.consultations
  drop constraint if exists consultations_health_worker_user_id_fkey;
alter table public.consultations
  alter column health_worker_user_id drop not null;
alter table public.consultations
  add constraint consultations_health_worker_user_id_fkey
  foreign key (health_worker_user_id)
  references public.health_worker_profiles (user_id)
  on delete set null;

alter table public.inventory_movements
  drop constraint if exists inventory_movements_moved_by_user_id_fkey;
alter table public.inventory_movements
  alter column moved_by_user_id drop not null;
alter table public.inventory_movements
  add constraint inventory_movements_moved_by_user_id_fkey
  foreign key (moved_by_user_id)
  references public.profiles (id)
  on delete set null;

alter table public.messages
  drop constraint if exists messages_sender_user_id_fkey;
alter table public.messages
  alter column sender_user_id drop not null;
alter table public.messages
  add constraint messages_sender_user_id_fkey
  foreign key (sender_user_id)
  references public.profiles (id)
  on delete set null;

commit;
