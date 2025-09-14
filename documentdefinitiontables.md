create table public.invoices (
  id uuid not null default extensions.uuid_generate_v4 (),
  craftsman_id uuid not null,
  customer_id uuid null,
  appointment_id uuid null,
  amount numeric(10, 2) not null,
  tax_amount numeric(10, 2) null,
  total_amount numeric(10, 2) not null,
  notes text null,
  due_date date null,
  service_date date null,
  location character varying(255) null,
  vat_exempt boolean null default false,
  type character varying(50) null default 'invoice'::character varying,
  status character varying(50) null default 'pending'::character varying,
  pdf_generated boolean null default false,
  paid_date timestamp without time zone null,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  total_materials_price numeric(10, 2) not null default 0.00,
  materials jsonb null,
  invoice_number_formatted character varying(50) null,
  tax_number character varying(50) null,
  vat_id character varying(50) null,
  small_business_exempt boolean null default false,
  invoice_type character varying(20) null default 'final'::character varying,
  legal_footer_text text null,
  payment_terms_days integer null default 14,
  issue_date date null,
  service_period_start date null,
  service_period_end date null,
  reverse_charge boolean null default false,
  dunning_level integer null default 0,
  last_dunning_date date null,
  dunning_fees numeric(10, 2) null default 0.00,
  constraint invoices_pkey primary key (id),
  constraint invoices_appointment_id_fkey foreign KEY (appointment_id) references appointments (id) on delete set null,
  constraint invoices_craftsman_id_fkey foreign KEY (craftsman_id) references craftsmen (id) on delete CASCADE,
  constraint invoices_customer_id_fkey foreign KEY (customer_id) references customers (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_invoices_craftsman on public.invoices using btree (craftsman_id) TABLESPACE pg_default;

create index IF not exists idx_invoices_customer on public.invoices using btree (customer_id) TABLESPACE pg_default;

create index IF not exists idx_invoices_appointment on public.invoices using btree (appointment_id) TABLESPACE pg_default;

create index IF not exists idx_invoices_status on public.invoices using btree (status) TABLESPACE pg_default;

create index IF not exists idx_invoices_type on public.invoices using btree (type) TABLESPACE pg_default;

create index IF not exists idx_invoices_due_date on public.invoices using btree (due_date) TABLESPACE pg_default;

create index IF not exists idx_invoices_number_formatted on public.invoices using btree (invoice_number_formatted) TABLESPACE pg_default;

create index IF not exists idx_invoices_issue_date on public.invoices using btree (issue_date) TABLESPACE pg_default;

create index IF not exists idx_invoices_dunning_level on public.invoices using btree (dunning_level) TABLESPACE pg_default;

create trigger set_invoices_timestamp BEFORE
update on invoices for EACH row
execute FUNCTION trigger_set_timestamp ();

create trigger trigger_set_invoice_number BEFORE INSERT on invoices for EACH row
execute FUNCTION set_invoice_number_trigger ();


create table public.quotes (
  id bigint generated always as identity not null,
  craftsman_id uuid not null,
  customer_id uuid not null,
  appointment_id uuid null,
  amount numeric(12, 2) not null,
  tax_amount numeric(12, 2) null,
  total_amount numeric(12, 2) not null,
  vat_exempt boolean null default false,
  notes text null,
  status text null default 'draft'::text,
  due_date date null,
  service_date date null,
  location text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  total_materials_price numeric(10, 2) not null default 0.00,
  materials jsonb null,
  uploaded_files jsonb null default '[]'::jsonb,
  constraint quotes_pkey primary key (id),
  constraint quotes_appointment_id_fkey foreign KEY (appointment_id) references appointments (id) on delete set null,
  constraint quotes_craftsman_id_fkey foreign KEY (craftsman_id) references craftsmen (id) on delete CASCADE,
  constraint quotes_customer_id_fkey foreign KEY (customer_id) references customers (id) on delete RESTRICT
) TABLESPACE pg_default;

create index IF not exists idx_quotes_uploaded_files on public.quotes using gin (uploaded_files) TABLESPACE pg_default;

create trigger quotes_set_updated_at BEFORE
update on quotes for EACH row
execute FUNCTION set_updated_at ();

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

create table public.appointments (
  id uuid not null default extensions.uuid_generate_v4 (),
  craftsman_id uuid not null,
  customer_id uuid null,
  scheduled_at timestamp without time zone not null,
  duration integer not null,
  status character varying(50) null default 'scheduled'::character varying,
  approval_status character varying(20) null default 'pending'::character varying,
  notes text null,
  location text null,
  has_invoice boolean null default false,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  service_type character varying(255) null,
  private boolean not null default false,
  price numeric(10, 2) null default null::numeric,
  constraint appointments_pkey primary key (id),
  constraint appointments_craftsman_id_fkey foreign KEY (craftsman_id) references craftsmen (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_appointments_craftsman_id on public.appointments using btree (craftsman_id) TABLESPACE pg_default;

create index IF not exists idx_appointments_craftsman on public.appointments using btree (craftsman_id) TABLESPACE pg_default;

create index IF not exists idx_appointments_customer on public.appointments using btree (customer_id) TABLESPACE pg_default;

create trigger set_timestamp_appointments BEFORE
update on appointments for EACH row
execute FUNCTION trigger_set_timestamp ();