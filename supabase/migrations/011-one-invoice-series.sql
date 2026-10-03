-- Visa Treat — 011: one invoice number series for every company
--
-- Every invoice, whichever company issues it (Arabiers, Visa Treat,
-- Tourmate), takes the next number in one series: 879-888, 879-889,
-- 879-890, … Quotations and receipts keep their per-company numbers.
--
-- Invoices already issued in another style (e.g. ARB-INV-0001) are
-- renumbered into the series, oldest first, after the invoices already in it.
--
-- Run the whole file in the Supabase SQL editor. Safe to run more than once.

-- The series lives on Visa Treat's invoice counter (set up by 007).
create or replace function public.assign_document_number(p_application uuid, p_series text)
returns text
language plpgsql
as $$
declare
  app     public.visa_applications%rowtype;
  prefix  text;
  fmt     text;
  n       integer;
  num     text;
  series_owner uuid;
begin
  if p_series not in ('invoice', 'quotation') then
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

  if p_series = 'invoice' then
    -- One series for all companies.
    select id into series_owner from public.issuers where slug = 'visatreat';
    n   := public.next_document_number(series_owner, 'invoice');
    num := public.format_document_number(null, 'invoice', n, 'dash3');

    update public.visa_applications
       set invoice_number = num,
           invoice_date   = (now() at time zone 'Asia/Dubai')::date
     where id = p_application;
  else
    select invoice_prefix into prefix from public.issuers where id = app.issued_by;
    n := public.next_document_number(app.issued_by, 'quotation');
    select number_format into fmt
      from public.document_counters
     where issuer_id = app.issued_by and series = 'quotation';
    num := public.format_document_number(prefix, 'quotation', n, fmt);

    update public.visa_applications
       set quotation_number = num,
           quotation_date   = (now() at time zone 'Asia/Dubai')::date
     where id = p_application;
  end if;

  return num;
end $$;

revoke all on function public.assign_document_number(uuid, text) from public, anon, authenticated;
grant execute on function public.assign_document_number(uuid, text) to service_role;

-- Bring existing invoices from other companies into the series.
do $$
declare
  vt uuid;
  r  record;
  n  integer;
begin
  select id into vt from public.issuers where slug = 'visatreat';

  -- The counter must be past every number already used.
  select greatest(
           coalesce((select next from public.document_counters where issuer_id = vt and series = 'invoice'), 879888),
           coalesce((select max(replace(invoice_number, '-', '')::integer) + 1
                       from public.visa_applications where invoice_number ~ '^\d{3}-\d{3}$'), 879888))
    into n;

  insert into public.document_counters (issuer_id, series, next, number_format)
  values (vt, 'invoice', n, 'dash3')
  on conflict (issuer_id, series) do update set next = excluded.next, number_format = 'dash3';

  alter table public.visa_applications disable trigger zz_lock_invoiced_application;
  alter table public.visa_applications disable trigger set_visa_vat;

  for r in
    select id from public.visa_applications
     where invoice_number is not null and invoice_number !~ '^\d{3}-\d{3}$'
     order by invoice_date, created_at
  loop
    update public.visa_applications
       set invoice_number = public.format_document_number(null, 'invoice',
                              public.next_document_number(vt, 'invoice'), 'dash3')
     where id = r.id;
  end loop;

  alter table public.visa_applications enable trigger set_visa_vat;
  alter table public.visa_applications enable trigger zz_lock_invoiced_application;
end $$;

notify pgrst, 'reload schema';

-- Check: every invoice in one series, and the next number.
select invoice_number, ref, invoice_date
  from public.visa_applications
 where invoice_number is not null
 order by invoice_number;

select 'next invoice' as what,
       public.format_document_number(null, 'invoice', c.next, 'dash3') as number
  from public.document_counters c
  join public.issuers i on i.id = c.issuer_id
 where i.slug = 'visatreat' and c.series = 'invoice';
