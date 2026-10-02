-- Visa Treat — 002: the lead → quote → invoice → payment workflow
--
-- Additive only: nothing in 001 is dropped or rewritten except that
-- visa_applications.issued_by becomes nullable, because a lead is taken before
-- anyone has chosen which company will bill it.
--
-- Run the whole file in the Supabase SQL editor. Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Lead fields on the application
-- ---------------------------------------------------------------------------

alter table public.visa_applications
  add column if not exists source text
    check (source in ('google_ads', 'organic', 'whatsapp', 'social', 'agent', 'other')),
  add column if not exists visa_type text
    check (visa_type in ('tourist','visit','transit','business','student','work','other')),
  add column if not exists travel_from date,
  add column if not exists travel_to date,
  add column if not exists quotation_date date;

-- A lead has no issuer yet. The VAT trigger already treats a missing issuer as
-- not registered (zero VAT), and nothing can be numbered until one is chosen.
alter table public.visa_applications alter column issued_by drop not null;

create index if not exists visa_applications_status_idx
  on public.visa_applications (status);

-- ---------------------------------------------------------------------------
-- 2. Placeholder flag on the catalogue
-- ---------------------------------------------------------------------------
-- The quote form shows a warning on any product still carrying placeholder
-- fees. Set it to false as each real rate is entered.

alter table public.visa_products
  add column if not exists placeholder boolean not null default false;

-- ---------------------------------------------------------------------------
-- 3. Destinations
-- ---------------------------------------------------------------------------
-- 'EU' stands for the Schengen area as a whole: one visa covers every member,
-- so it is quoted as one destination. (EU is an ISO "exceptionally reserved"
-- code, not a country.)

insert into public.countries (code, name) values
  ('EU', 'Schengen Area'),
  ('GB', 'United Kingdom'),
  ('US', 'United States'),
  ('ID', 'Indonesia'),
  ('CA', 'Canada'),
  ('AU', 'Australia'),
  ('NZ', 'New Zealand'),
  ('IE', 'Ireland'),
  ('JP', 'Japan'),
  ('CN', 'China'),
  ('KR', 'South Korea'),
  ('SG', 'Singapore'),
  ('MY', 'Malaysia'),
  ('TH', 'Thailand'),
  ('VN', 'Vietnam'),
  ('IN', 'India'),
  ('LK', 'Sri Lanka'),
  ('TR', 'Turkey'),
  ('SA', 'Saudi Arabia'),
  ('OM', 'Oman'),
  ('QA', 'Qatar'),
  ('EG', 'Egypt'),
  ('GE', 'Georgia'),
  ('AZ', 'Azerbaijan'),
  ('RU', 'Russia'),
  ('ZA', 'South Africa'),
  ('KE', 'Kenya'),
  ('MA', 'Morocco')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Placeholder catalogue — NOT REAL RATES
-- ---------------------------------------------------------------------------
-- Enough for the quote form to have something to pick. Every row is flagged
-- placeholder = true and the UI says so. Replace with the real price list.

insert into public.visa_products
  (country_code, name, visa_type, entries, duration_days,
   processing_days_min, processing_days_max,
   government_fee, default_service_charge, default_selling_price,
   terms, placeholder, sort_order)
values
  ('EU', 'Schengen short-stay tourist visa', 'tourist', 'single', 90, 15, 45,
   365, 250, 615, null, true, 1),
  ('GB', 'UK Standard Visitor visa (6 months)', 'visit', 'multiple', 180, 15, 21,
   600, 300, 900, null, true, 2),
  ('US', 'USA B1/B2 visitor visa', 'visit', 'multiple', 3650, 30, 90,
   680, 350, 1030, null, true, 3),
  ('ID', 'Indonesia e-Visa on Arrival (30 days)', 'tourist', 'single', 30, 2, 3,
   200, 100, 300, null, true, 4),
  ('ID', 'Indonesia single-entry tourist visa (60 days)', 'tourist', 'single', 60, 5, 7,
   750, 150, 900, null, true, 5)
on conflict (country_code, name) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Numbering a document onto an application
-- ---------------------------------------------------------------------------
-- Locks the application row, so pressing "Invoice" twice — or two people
-- pressing it at once — gets the same number back instead of burning a second
-- one. Format: <ISSUER_PREFIX>-<INV|QUO>-0001.

create or replace function public.assign_document_number(p_application uuid, p_series text)
returns text
language plpgsql
as $$
declare
  app    public.visa_applications%rowtype;
  prefix text;
  code   text;
  n      integer;
  num    text;
begin
  code := case p_series when 'invoice' then 'INV' when 'quotation' then 'QUO' end;
  if code is null then
    raise exception 'Unknown document series %', p_series;
  end if;

  select * into app from public.visa_applications where id = p_application for update;
  if not found then
    raise exception 'Application % not found', p_application;
  end if;

  if p_series = 'invoice' and app.invoice_number is not null then
    return app.invoice_number;
  end if;
  if p_series = 'quotation' and app.quotation_number is not null then
    return app.quotation_number;
  end if;

  if app.issued_by is null then
    raise exception 'Choose the issuing company before numbering a document';
  end if;
  if app.status = 'cancelled' then
    raise exception 'Application % is cancelled', app.ref;
  end if;
  if p_series = 'invoice' and app.grand_total <= 0 then
    raise exception 'Application % has no price to invoice', app.ref;
  end if;

  select invoice_prefix into prefix from public.issuers where id = app.issued_by;
  n   := public.next_document_number(app.issued_by, p_series);
  num := prefix || '-' || code || '-' || lpad(n::text, 4, '0');

  if p_series = 'invoice' then
    update public.visa_applications
       set invoice_number = num,
           invoice_date   = (now() at time zone 'Asia/Dubai')::date
     where id = p_application;
  else
    update public.visa_applications
       set quotation_number = num,
           quotation_date   = (now() at time zone 'Asia/Dubai')::date
     where id = p_application;
  end if;

  return num;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Recording a payment
-- ---------------------------------------------------------------------------
-- Locks the application so two payments entered at once cannot together
-- exceed what is owed, and numbers the receipt <ISSUER_PREFIX>-RCT-0001.

create or replace function public.record_payment(
  p_application uuid,
  p_amount      numeric,
  p_method      text,
  p_paid_at     date,
  p_reference   text,
  p_received_by text,
  p_note        text
)
returns public.payments
language plpgsql
as $$
declare
  app       public.visa_applications%rowtype;
  paid      numeric(10,2);
  prefix    text;
  n         integer;
  v_payment public.payments%rowtype;
begin
  select * into app from public.visa_applications where id = p_application for update;
  if not found then
    raise exception 'Application % not found', p_application;
  end if;
  if app.issued_by is null then
    raise exception 'Choose the issuing company before taking payment';
  end if;
  if app.status = 'cancelled' then
    raise exception 'Application % is cancelled', app.ref;
  end if;

  select coalesce(sum(amount), 0) into paid
    from public.payments where application_id = p_application;

  if paid + p_amount > app.grand_total then
    raise exception 'Payment of % is more than the balance of %', p_amount, app.grand_total - paid;
  end if;

  select invoice_prefix into prefix from public.issuers where id = app.issued_by;
  n := public.next_document_number(app.issued_by, 'receipt');

  insert into public.payments
    (application_id, paid_at, amount, method, reference, receipt_number, received_by, note)
  values
    (p_application,
     coalesce(p_paid_at, (now() at time zone 'Asia/Dubai')::date),
     p_amount, p_method, nullif(p_reference, ''),
     prefix || '-RCT-' || lpad(n::text, 4, '0'),
     p_received_by, nullif(p_note, ''))
  returning * into v_payment;

  return v_payment;
end $$;

-- ---------------------------------------------------------------------------
-- 7. An invoice, once issued, does not change
-- ---------------------------------------------------------------------------
-- Named zz_ so it fires after set_visa_vat (same-event triggers run in name
-- order). That matters: set_visa_vat recomputes the tax from the issuer's
-- current registration on every update, and an issued invoice must keep the
-- tax it was issued with even if the company's registration changes later.

create or replace function public.zz_lock_invoiced_application()
returns trigger
language plpgsql
as $$
begin
  if old.invoice_number is not null then
    if new.invoice_number is distinct from old.invoice_number
       or new.invoice_date is distinct from old.invoice_date
       or new.issued_by    is distinct from old.issued_by
       or new.client_id    is distinct from old.client_id
       or new.quantity       <> old.quantity
       or new.government_fee <> old.government_fee
       or new.service_charge <> old.service_charge
       or new.selling_price  <> old.selling_price
    then
      raise exception 'Application % is invoiced as %; its figures cannot change',
        old.ref, old.invoice_number;
    end if;

    new.taxable_amount := old.taxable_amount;
    new.vat_amount     := old.vat_amount;
    new.grand_total    := old.grand_total;
    return new;
  end if;

  if new.issued_by is distinct from old.issued_by then
    if exists (select 1 from public.payments where application_id = old.id) then
      raise exception 'Application % has payments receipted under its current company', old.ref;
    end if;
    -- A quotation number belongs to the company that issued it.
    new.quotation_number := null;
    new.quotation_date   := null;
  end if;

  return new;
end $$;

drop trigger if exists zz_lock_invoiced_application on public.visa_applications;
create trigger zz_lock_invoiced_application
  before update on public.visa_applications
  for each row execute function public.zz_lock_invoiced_application();

-- ---------------------------------------------------------------------------
-- 8. Only the server may call these
-- ---------------------------------------------------------------------------

revoke all on function public.next_document_number(uuid, text) from public, anon, authenticated;
revoke all on function public.assign_document_number(uuid, text) from public, anon, authenticated;
revoke all on function public.record_payment(uuid, numeric, text, date, text, text, text)
  from public, anon, authenticated;

grant execute on function public.next_document_number(uuid, text) to service_role;
grant execute on function public.assign_document_number(uuid, text) to service_role;
grant execute on function public.record_payment(uuid, numeric, text, date, text, text, text)
  to service_role;

notify pgrst, 'reload schema';
