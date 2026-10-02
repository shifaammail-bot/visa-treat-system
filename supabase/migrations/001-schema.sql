-- Visa Treat — the starting schema
--
-- Run this in the Supabase SQL editor. The editor wraps the WHOLE FILE in one
-- transaction: a failure anywhere rolls back everything before it, so re-run
-- the complete file rather than the part after the error.
--
-- Safe to run more than once.
--
-- House rules applied throughout:
--   * every table gets RLS and `revoke all from anon`, with no policy.
--     Supabase grants anon new tables in public by default and that key is in
--     the browser. All reads go through the service role, server-side.
--   * money is numeric(10,2). Never a float: 0.1 + 0.2 on a tax invoice is a
--     conversation with an auditor.
--   * VAT is computed by a trigger as well as in lib/vat.ts, and the two are
--     checked against each other in the tests.

-- ---------------------------------------------------------------------------
-- 1. Staff
-- ---------------------------------------------------------------------------

create table if not exists public.staff (
  email          text primary key,
  full_name      text not null,
  role           text not null default 'consultant'
                 check (role in ('admin', 'manager', 'consultant', 'accounts')),
  -- Which companies a manager covers. Null means all of them.
  issuer_ids     uuid[],
  monthly_target numeric(10,2),
  active         boolean not null default true,
  joined_at      date not null default ((now() at time zone 'Asia/Dubai')::date)
);

alter table public.staff enable row level security;
revoke all on public.staff from anon;

-- ---------------------------------------------------------------------------
-- 2. The three companies
-- ---------------------------------------------------------------------------
-- A row rather than a constant, so a fourth company is a row and not a deploy.
--
-- vat_registered is the flag the document branches on. A company without a TRN
-- issues an "Invoice", not a "Tax Invoice", and prints no VAT line at all —
-- see SPEC.md §5.2. It defaults to false because that is the document that
-- cannot be illegal.

create table if not exists public.issuers (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  trade_name        text not null,
  legal_name        text not null,
  trn               text,
  vat_registered    boolean not null default false,
  licence_no        text,
  chamber_no        text,
  address           text not null default '',
  email             text not null default '',
  phone             text not null default '',
  website           text not null default '',
  accent_colour     text not null default '#2bb6c9',
  logo_key          text,
  bank_name         text,
  bank_account_name text,
  bank_iban         text,
  bank_swift        text,
  invoice_prefix    text unique not null,
  active            boolean not null default true,
  sort_order        integer not null default 0,

  -- A TRN is required to claim VAT registration. The database refuses the
  -- half-filled state rather than leaving the renderer to notice it.
  constraint issuers_trn_when_registered
    check (not vat_registered or trn is not null)
);

alter table public.issuers enable row level security;
revoke all on public.issuers from anon;

-- Arabiers' details are known and in use on real tax invoices.
-- The other two are placeholders: fill them in from DECISIONS.md §1 and §3
-- before anything is issued in their name.
insert into public.issuers
  (slug, trade_name, legal_name, trn, vat_registered, licence_no, chamber_no,
   address, email, phone, website, accent_colour, invoice_prefix, sort_order)
values
  ('arabiers', 'Arabiers Holidays', 'Arabiers Travel & Tourism LLC',
   '104263844300003', true, '1176592', '485067',
   '512, Hamrain Center, Deira, Dubai, UAE', 'explore@arabiers.com',
   '+971 42 689 344', 'arabiers.com', '#2bb6c9', 'ARB', 1),
  ('visatreat', 'Visa Treat', 'TO BE SUPPLIED',
   null, false, null, null, '', '', '', '', '#1f6fb2', 'VT', 2),
  ('tourmate', 'Tourmate', 'TO BE SUPPLIED',
   null, false, null, null, '', '', '', '', '#b7791f', 'TM', 3)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Countries and the catalogue
-- ---------------------------------------------------------------------------

create table if not exists public.countries (
  code   text primary key,          -- ISO-3166-1 alpha-2
  name   text not null,
  active boolean not null default true
);

alter table public.countries enable row level security;
revoke all on public.countries from anon;

create table if not exists public.visa_products (
  id                     uuid primary key default gen_random_uuid(),
  country_code           text not null references public.countries(code),
  name                   text not null,
  visa_type              text not null default 'tourist'
                         check (visa_type in ('tourist','visit','transit','business','student','work','other')),
  entries                text not null default 'single'
                         check (entries in ('single','multiple')),
  duration_days          integer not null check (duration_days > 0),
  processing_days_min    integer not null default 2 check (processing_days_min >= 0),
  processing_days_max    integer not null default 3 check (processing_days_max >= 0),
  express                boolean not null default false,

  -- Split in two on purpose. The government fee is collected on behalf of the
  -- authority — a disbursement, no VAT from us. The service charge is the only
  -- taxable supply. Do not collapse these into one "price".
  government_fee         numeric(10,2) not null default 0 check (government_fee >= 0),
  default_service_charge numeric(10,2) not null default 70 check (default_service_charge >= 0),
  default_selling_price  numeric(10,2) not null default 0 check (default_selling_price >= 0),

  default_issuer_id      uuid references public.issuers(id),
  terms                  text,
  active                 boolean not null default true,
  sort_order             integer not null default 0,
  updated_at             timestamptz not null default now(),

  unique (country_code, name)
);

alter table public.visa_products enable row level security;
revoke all on public.visa_products from anon;

create index if not exists visa_products_country_idx
  on public.visa_products (country_code) where active;

-- ---------------------------------------------------------------------------
-- 4. Clients
-- ---------------------------------------------------------------------------
-- Separate from the application because the same person applies again, and
-- because a family of four applying together is one invoice to one client.

create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  created_by  text references public.staff(email),
  full_name   text not null,
  nationality text not null,
  phone       text,
  email       text,
  passport_no text,
  -- The client's own reference, printed on documents so they can match it
  -- against whatever they are tracking it under.
  client_ref  text,
  notes       text
);

alter table public.clients enable row level security;
revoke all on public.clients from anon;

create index if not exists clients_name_idx on public.clients (lower(full_name));
create index if not exists clients_phone_idx on public.clients (phone);

-- ---------------------------------------------------------------------------
-- 5. Applications — the sale
-- ---------------------------------------------------------------------------

create sequence if not exists public.application_ref_seq start 1;

create table if not exists public.visa_applications (
  id          uuid primary key default gen_random_uuid(),
  ref         text unique not null default '',
  created_at  timestamptz not null default now(),
  created_by  text references public.staff(email),
  -- Who handled it. Not created_by: an admin may enter a sale on somebody's
  -- behalf, and the performance report counts this one.
  consultant  text not null,

  client_id    uuid not null references public.clients(id),
  country_code text not null references public.countries(code),
  product_id   uuid references public.visa_products(id),
  -- Copied, not joined. Renaming or retiring a product must never rewrite a
  -- sale already made.
  product_name text not null,

  issued_by    uuid not null references public.issuers(id),

  quantity       integer not null default 1 check (quantity > 0),
  government_fee numeric(10,2) not null default 0 check (government_fee >= 0),
  service_charge numeric(10,2) not null default 0 check (service_charge >= 0),
  selling_price  numeric(10,2) not null default 0 check (selling_price >= 0),
  cost_price     numeric(10,2) not null default 0 check (cost_price >= 0),

  -- Set by the trigger below, never by the application.
  taxable_amount numeric(10,2) not null default 0,
  vat_amount     numeric(10,2) not null default 0,
  grand_total    numeric(10,2) not null default 0,

  status       text not null default 'enquiry'
               check (status in ('enquiry','quoted','submitted','approved','rejected','cancelled')),
  submitted_at date,
  decided_at   date,

  -- The date printed on the document. Not created_at: an invoice is sometimes
  -- raised for a day other than the one it was typed on, and revenue is
  -- reported on this one.
  invoice_date date not null default ((now() at time zone 'Asia/Dubai')::date),

  -- Assigned the first time each document is made, and never again.
  invoice_number   text unique,
  quotation_number text unique,

  terms text,
  notes text
);

alter table public.visa_applications enable row level security;
revoke all on public.visa_applications from anon;

create index if not exists visa_applications_created_at_idx
  on public.visa_applications (created_at desc);
create index if not exists visa_applications_consultant_idx
  on public.visa_applications (consultant);
create index if not exists visa_applications_issuer_idx
  on public.visa_applications (issued_by);
create index if not exists visa_applications_invoice_date_idx
  on public.visa_applications (invoice_date);

-- The reference, on insert only.
create or replace function public.set_application_ref()
returns trigger language plpgsql as $$
begin
  if new.ref is null or new.ref = '' then
    new.ref := 'VT-' || lpad(nextval('public.application_ref_seq')::text, 4, '0');
  end if;
  return new;
end $$;

drop trigger if exists set_application_ref on public.visa_applications;
create trigger set_application_ref
  before insert on public.visa_applications
  for each row execute function public.set_application_ref();

-- The VAT, computed rather than trusted. On insert and on update, so a charge
-- corrected later corrects the tax with it.
--
-- It reads vat_registered off the issuing company: a company with no TRN makes
-- no taxable supply, so the split is zero and the document shows no VAT line.
-- The client pays the same figure either way.
create or replace function public.set_visa_vat()
returns trigger language plpgsql as $$
declare
  charged    numeric(10,2) := new.service_charge * new.quantity;
  registered boolean;
begin
  select i.vat_registered and i.trn is not null
    into registered
    from public.issuers i
   where i.id = new.issued_by;

  if coalesce(registered, false) then
    new.taxable_amount := round(charged / 1.05, 2);
    new.vat_amount     := round(new.taxable_amount * 0.05, 2);
  else
    new.taxable_amount := 0;
    new.vat_amount     := 0;
  end if;

  new.grand_total := round(new.selling_price * new.quantity, 2);
  return new;
end $$;

drop trigger if exists set_visa_vat on public.visa_applications;
create trigger set_visa_vat
  before insert or update on public.visa_applications
  for each row execute function public.set_visa_vat();

-- ---------------------------------------------------------------------------
-- 6. Payments
-- ---------------------------------------------------------------------------
-- No balance column. A stored balance and a payment row disagree the first
-- time somebody edits one, and then nobody knows which is right.

create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.visa_applications(id) on delete restrict,
  paid_at        date not null default ((now() at time zone 'Asia/Dubai')::date),
  amount         numeric(10,2) not null check (amount > 0),
  method         text not null
                 check (method in ('cash','card','bank transfer','link','cheque')),
  reference      text,
  receipt_number text unique,
  received_by    text references public.staff(email),
  note           text
);

alter table public.payments enable row level security;
revoke all on public.payments from anon;

create index if not exists payments_application_idx
  on public.payments (application_id);

-- `on delete restrict` above is deliberate: an application with money against
-- it cannot be deleted out from under its receipts.

-- ---------------------------------------------------------------------------
-- 7. Document numbering
-- ---------------------------------------------------------------------------
-- One unbroken series per company per document type. Three legal entities
-- cannot share one invoice run — each files its own return.

create table if not exists public.document_counters (
  issuer_id uuid not null references public.issuers(id),
  series    text not null check (series in ('quotation','invoice','receipt')),
  next      integer not null default 1 check (next > 0),
  primary key (issuer_id, series)
);

alter table public.document_counters enable row level security;
revoke all on public.document_counters from anon;

create or replace function public.next_document_number(p_issuer uuid, p_series text)
returns integer
language plpgsql
as $$
declare
  n integer;
begin
  insert into public.document_counters (issuer_id, series)
  values (p_issuer, p_series)
  on conflict do nothing;

  -- `for update` is the whole point. Without it two consultants pressing
  -- Invoice at the same moment read the same `next`, and two invoices carry
  -- one number — the single failure an auditor will certainly find.
  select next into n
    from public.document_counters
   where issuer_id = p_issuer and series = p_series
     for update;

  update public.document_counters
     set next = next + 1
   where issuer_id = p_issuer and series = p_series;

  return n;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Seed a country so the catalogue is not empty
-- ---------------------------------------------------------------------------

insert into public.countries (code, name) values
  ('AE', 'United Arab Emirates')
on conflict (code) do nothing;

analyze;

notify pgrst, 'reload schema';
