-- Visa Treat — 008: admins can correct everything on a sale
--
-- While the system is being set up, admins need to fix any part of a sale,
-- issued or not: company, visa and prices, invoice and quotation numbers and
-- dates, status, destination, visa type, source, consultant and notes.
-- Payments are edited directly by the app (admins only) and need nothing here.
--
-- Everything goes through admin_update_application(), which records who made
-- the change and when. For everyone else the invoice lock is exactly as before.
--
-- Replaces 005/006's admin_update_invoiced_application (left in place, unused).
-- Run the whole file in the Supabase SQL editor. Safe to run more than once.

alter table public.visa_applications
  add column if not exists edited_at timestamptz,
  add column if not exists edited_by text;

-- The invoice lock, with one way through: a transaction-local flag that only
-- admin_update_application sets.
create or replace function public.zz_lock_invoiced_application()
returns trigger
language plpgsql
as $$
begin
  -- An admin correction: allow it, and keep the VAT set_visa_vat just worked out.
  if coalesce(current_setting('visa.admin_edit', true), '') = 'on'
     or coalesce(current_setting('visa.admin_invoice_edit', true), '') = 'on' then
    return new;
  end if;

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
      raise exception 'Application % is invoiced as %; only an admin can change it',
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

-- Change any editable field of a sale. p_changes holds only the fields being
-- changed, e.g. {"selling_price": 600, "invoice_number": "879-888"}; anything
-- not mentioned keeps its current value. Totals and VAT are recalculated.
create or replace function public.admin_update_application(
  p_application uuid,
  p_changes     jsonb,
  p_edited_by   text
)
returns void
language plpgsql
as $$
declare
  cur public.visa_applications%rowtype;
  r   public.visa_applications%rowtype;
begin
  select * into cur from public.visa_applications where id = p_application for update;
  if not found then
    raise exception 'Application % not found', p_application;
  end if;

  r := jsonb_populate_record(cur, p_changes);

  perform set_config('visa.admin_edit', 'on', true);

  update public.visa_applications
     set issued_by        = r.issued_by,
         product_id       = r.product_id,
         product_name     = r.product_name,
         country_code     = r.country_code,
         visa_type        = r.visa_type,
         source           = r.source,
         consultant       = r.consultant,
         quantity         = r.quantity,
         government_fee   = r.government_fee,
         service_charge   = r.service_charge,
         selling_price    = r.selling_price,
         cost_price       = r.cost_price,
         terms            = r.terms,
         notes            = r.notes,
         status           = r.status,
         submitted_at     = r.submitted_at,
         decided_at       = r.decided_at,
         invoice_number   = r.invoice_number,
         invoice_date     = r.invoice_date,
         quotation_number = r.quotation_number,
         quotation_date   = r.quotation_date,
         edited_at        = now(),
         edited_by        = p_edited_by
   where id = p_application;

  perform set_config('visa.admin_edit', 'off', true);
end $$;

revoke all on function public.admin_update_application(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.admin_update_application(uuid, jsonb, text) to service_role;

notify pgrst, 'reload schema';
