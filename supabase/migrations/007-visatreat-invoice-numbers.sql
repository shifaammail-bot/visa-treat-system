-- Visa Treat — 007: Visa Treat invoices numbered 879-888, 879-889, …
--
-- Visa Treat invoices drop the "VT-INV-0001" style. They run as plain
-- numbers in the form NNN-NNN, in strict order: 879-888, 879-889, … 879-999,
-- 880-000, …
--
-- Invoices already issued under Visa Treat are renumbered, oldest first, so
-- the first one becomes 879-888 and the counter carries on after the last.
-- Quotations, receipts and the other companies keep their current format.
--
-- Run the whole file in the Supabase SQL editor. Safe to run more than once:
-- invoices already in the new format are left alone and the counter never
-- goes backwards.

-- 1. A per-series number style. Null keeps <PREFIX>-<INV|QUO>-0001.
alter table public.document_counters
  add column if not exists number_format text
    check (number_format in ('dash3'));

-- 2. Numbering honours the style.
create or replace function public.format_document_number(
  p_prefix text, p_series text, p_n integer, p_format text
)
returns text
language sql
immutable
as $$
  select case p_format
    -- 879888 -> 879-888
    when 'dash3' then (p_n / 1000)::text || '-' || lpad((p_n % 1000)::text, 3, '0')
    else p_prefix || '-' || case p_series when 'invoice' then 'INV' else 'QUO' end
                  || '-' || lpad(p_n::text, 4, '0')
  end
$$;

create or replace function public.assign_document_number(p_application uuid, p_series text)
returns text
language plpgsql
as $$
declare
  app    public.visa_applications%rowtype;
  prefix text;
  fmt    text;
  n      integer;
  num    text;
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

  select invoice_prefix into prefix from public.issuers where id = app.issued_by;
  n := public.next_document_number(app.issued_by, p_series);
  select number_format into fmt
    from public.document_counters
   where issuer_id = app.issued_by and series = p_series;
  num := public.format_document_number(prefix, p_series, n, fmt);

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

revoke all on function public.assign_document_number(uuid, text) from public, anon, authenticated;
grant execute on function public.assign_document_number(uuid, text) to service_role;

-- 3. Renumber Visa Treat's existing invoices and set the counter.
do $$
declare
  vt   uuid;
  n    integer;
  r    record;
begin
  select id into vt from public.issuers where slug = 'visatreat';
  if vt is null then
    raise exception 'No issuer with slug visatreat';
  end if;

  -- Carry on after any invoice already in the new style (re-runs).
  select coalesce(max(replace(invoice_number, '-', '')::integer) + 1, 879888)
    into n
    from public.visa_applications
   where issued_by = vt and invoice_number ~ '^\d{3}-\d{3}$';

  -- Issued invoices are locked against renumbering; lift the lock just for
  -- this one-off change, without touching their figures or VAT.
  alter table public.visa_applications disable trigger zz_lock_invoiced_application;
  alter table public.visa_applications disable trigger set_visa_vat;

  for r in
    select id
      from public.visa_applications
     where issued_by = vt
       and invoice_number is not null
       and invoice_number !~ '^\d{3}-\d{3}$'
     order by invoice_date, created_at, invoice_number
  loop
    update public.visa_applications
       set invoice_number = public.format_document_number('VT', 'invoice', n, 'dash3')
     where id = r.id;
    n := n + 1;
  end loop;

  alter table public.visa_applications enable trigger set_visa_vat;
  alter table public.visa_applications enable trigger zz_lock_invoiced_application;

  insert into public.document_counters (issuer_id, series, next, number_format)
  values (vt, 'invoice', n, 'dash3')
  on conflict (issuer_id, series)
  do update set next = greatest(excluded.next,
                                case when public.document_counters.number_format = 'dash3'
                                     then public.document_counters.next else 0 end),
                number_format = 'dash3';
end $$;

notify pgrst, 'reload schema';

-- Check: Visa Treat invoices and the next number to be issued.
select a.invoice_number, a.invoice_date, a.ref
  from public.visa_applications a
  join public.issuers i on i.id = a.issued_by
 where i.slug = 'visatreat' and a.invoice_number is not null
 order by a.invoice_number;

select c.series, c.next, c.number_format,
       public.format_document_number(i.invoice_prefix, c.series, c.next, c.number_format) as next_number
  from public.document_counters c
  join public.issuers i on i.id = c.issuer_id
 where i.slug = 'visatreat';
