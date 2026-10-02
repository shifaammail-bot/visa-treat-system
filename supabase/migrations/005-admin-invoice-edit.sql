-- Visa Treat — 005: admins may correct an issued invoice
--
-- Until now an invoice's figures were frozen the moment it was numbered. An
-- admin can now correct the visa description, guests, prices, cost and terms
-- through admin_update_invoiced_application(), and only through it. Every such
-- edit records who made it and when.
--
-- Still never allowed, for anyone: changing the invoice number, the invoice
-- date, the issuing company or the client — the numbering series and the
-- company's tax records depend on those.
--
-- Run the whole file in the Supabase SQL editor. Safe to run more than once.

alter table public.visa_applications
  add column if not exists edited_at timestamptz,
  add column if not exists edited_by text;

-- The lock, now with one way through: a transaction-local flag that only the
-- admin function below sets.
create or replace function public.zz_lock_invoiced_application()
returns trigger
language plpgsql
as $$
declare
  admin_edit boolean := coalesce(current_setting('visa.admin_invoice_edit', true), '') = 'on';
begin
  if old.invoice_number is not null then
    if new.invoice_number is distinct from old.invoice_number
       or new.invoice_date is distinct from old.invoice_date
       or new.issued_by    is distinct from old.issued_by
       or new.client_id    is distinct from old.client_id
    then
      raise exception 'Application % is invoiced as %; its number, date, company and client cannot change',
        old.ref, old.invoice_number;
    end if;

    -- An admin correction: keep the VAT that set_visa_vat just recomputed.
    if admin_edit then
      return new;
    end if;

    if new.quantity       <> old.quantity
       or new.government_fee <> old.government_fee
       or new.service_charge <> old.service_charge
       or new.selling_price  <> old.selling_price
    then
      raise exception 'Application % is invoiced as %; only an admin can change its figures',
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

-- The only way to change an issued invoice's figures. The app calls it for
-- admins only; the database refuses a total below what has been paid.
create or replace function public.admin_update_invoiced_application(
  p_application    uuid,
  p_product_id     uuid,
  p_product_name   text,
  p_quantity       integer,
  p_service_charge numeric,
  p_selling_price  numeric,
  p_cost_price     numeric,
  p_terms          text,
  p_edited_by      text
)
returns void
language plpgsql
as $$
declare
  app  public.visa_applications%rowtype;
  paid numeric(10,2);
begin
  select * into app from public.visa_applications where id = p_application for update;
  if not found then
    raise exception 'Application % not found', p_application;
  end if;
  if app.invoice_number is null then
    raise exception 'Application % is not invoiced', app.ref;
  end if;

  select coalesce(sum(amount), 0) into paid
    from public.payments where application_id = p_application;
  if round(p_selling_price * p_quantity, 2) < paid then
    raise exception 'The new total % is less than the % already paid on this invoice',
      round(p_selling_price * p_quantity, 2), paid;
  end if;

  perform set_config('visa.admin_invoice_edit', 'on', true);

  update public.visa_applications
     set product_id     = p_product_id,
         product_name   = p_product_name,
         quantity       = p_quantity,
         government_fee = 0,
         service_charge = p_service_charge,
         selling_price  = p_selling_price,
         cost_price     = coalesce(p_cost_price, cost_price),
         terms          = p_terms,
         edited_at      = now(),
         edited_by      = p_edited_by
   where id = p_application;

  perform set_config('visa.admin_invoice_edit', 'off', true);
end $$;

revoke all on function public.admin_update_invoiced_application(uuid, uuid, text, integer, numeric, numeric, numeric, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_update_invoiced_application(uuid, uuid, text, integer, numeric, numeric, numeric, text, text)
  to service_role;

notify pgrst, 'reload schema';
