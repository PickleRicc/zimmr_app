-- Migration: create appointments table
-- Generated 2025-06-27

create table if not exists public.appointments (
  id uuid primary key default extensions.uuid_generate_v4 (),
  craftsman_id uuid not null references public.craftsmen(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  scheduled_at timestamp without time zone not null,
  duration integer not null,
  status varchar(50) default 'scheduled',
  approval_status varchar(20) default 'pending',
  notes text,
  location text,
  has_invoice boolean default false,
  service_type varchar(255),
  created_at timestamp without time zone default current_timestamp,
  updated_at timestamp without time zone default current_timestamp
);

create index if not exists idx_appointments_craftsman_id on public.appointments(craftsman_id);
create index if not exists idx_appointments_customer_id on public.appointments(customer_id);
create index if not exists idx_appointments_scheduled_at on public.appointments(scheduled_at);

-- auto-update updated_at timestamp on row update
create or replace function trigger_set_timestamp()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;

create trigger set_timestamp_appointments
before update on public.appointments
for each row execute function trigger_set_timestamp();
