create table public.customers (
  id uuid not null default extensions.uuid_generate_v4 (),
  craftsman_id uuid not null,
  name character varying(255) not null,
  phone character varying(50) null,
  email character varying(255) null,
  address text null,
  service_type character varying(255) null,
  notes text null,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  constraint customers_pkey primary key (id),
  constraint customers_craftsman_id_fkey foreign KEY (craftsman_id) references craftsmen (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_customers_craftsman on public.customers using btree (craftsman_id) TABLESPACE pg_default;

create index IF not exists idx_customers_name on public.customers using btree (name) TABLESPACE pg_default;

create index IF not exists idx_customers_phone on public.customers using btree (phone) TABLESPACE pg_default;

create index IF not exists idx_customers_service_type on public.customers using btree (service_type) TABLESPACE pg_default;

create trigger set_customers_timestamp BEFORE
update on customers for EACH row
execute FUNCTION trigger_set_timestamp ();