-- Visa Treat — 012: restore the super admin edit lock
--
-- 005 was run again after 008, which put back an older invoice lock that
-- refuses to change an invoice's company, number, date or client even for
-- the super admin ("its number, date, company and client cannot change").
-- This puts back the 008 lock: the super admin's edits go through, everyone
-- else's invoices stay locked.
--
-- Run the whole file in the Supabase SQL editor. Safe to run more than once.
-- Don't re-run 005 or 006 after this; they are superseded.

create or replace function public.zz_lock_invoiced_application()
returns trigger
language plpgsql
as $$
begin
  -- A super admin correction (admin_update_application): allow it, and keep
  -- the VAT set_visa_vat just worked out.
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
      raise exception 'Invoice % is locked; only the super admin can change it', old.invoice_number;
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

-- The super admin edit sets both flags, so it works with either lock version.
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
  perform set_config('visa.admin_invoice_edit', 'on', true);

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
  perform set_config('visa.admin_invoice_edit', 'off', true);
end $$;

revoke all on function public.admin_update_application(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.admin_update_application(uuid, jsonb, text) to service_role;

notify pgrst, 'reload schema';

select 'admin edit lock restored' as status;
