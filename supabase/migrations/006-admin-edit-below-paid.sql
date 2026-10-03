-- Visa Treat — 006: admins may lower an invoice that is already paid
-- SUPERSEDED: do not run again. 008 and 012 replace this file.
--
-- 005 refused an admin edit that took the total below what had been paid.
-- That blocked correcting a fully paid invoice. The edit is now allowed; the
-- difference shows as "refund due" on the sale and on the invoice PDF.
--
-- Run the whole file in the Supabase SQL editor. Safe to run more than once.

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
  app public.visa_applications%rowtype;
begin
  select * into app from public.visa_applications where id = p_application for update;
  if not found then
    raise exception 'Application % not found', p_application;
  end if;
  if app.invoice_number is null then
    raise exception 'Application % is not invoiced', app.ref;
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
