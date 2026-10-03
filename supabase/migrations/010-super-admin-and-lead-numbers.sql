-- Visa Treat — 010: super admin, and lead numbers L1, L2, L3…
--
-- 1. A super_admin role. Super admin (Shifaam) alone can change or delete
--    what is already recorded: issued invoices, lead details and status,
--    payments, clients, staff. Admins (Munas, Shahna) see everything and do
--    the daily work: leads, follow-ups, quotes, invoices, payments.
-- 2. Every lead / sale gets an internal number L1, L2, L3… in order. Existing
--    records are renumbered oldest first. Invoice numbers are unchanged.
--
-- Run the whole file in the Supabase SQL editor. Safe to run more than once.

-- 1. Roles
alter table public.staff drop constraint if exists staff_role_check;
alter table public.staff
  add constraint staff_role_check
  check (role in ('super_admin', 'admin', 'manager', 'consultant', 'accounts'));

update public.staff set role = 'super_admin' where lower(email) = 'shifaammail@gmail.com';

-- 2. Lead numbers
create sequence if not exists public.lead_ref_seq start 1;

do $$
declare
  n integer;
  r record;
begin
  -- Carry on after any record already numbered L… (re-runs).
  select coalesce(max(substring(ref from 2)::integer), 0)
    into n
    from public.visa_applications
   where ref ~ '^L\d+$';

  for r in
    select id from public.visa_applications
     where ref !~ '^L\d+$'
     order by created_at, ref
  loop
    n := n + 1;
    -- ref isn't one of the locked invoice fields, so this is a plain update.
    update public.visa_applications set ref = 'L' || n where id = r.id;
  end loop;

  perform setval('public.lead_ref_seq', greatest(n, 1), n > 0);
end $$;

create or replace function public.set_application_ref()
returns trigger language plpgsql as $$
begin
  if new.ref is null or new.ref = '' then
    new.ref := 'L' || nextval('public.lead_ref_seq');
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';

-- Check
select email, role from public.staff order by role, email;
select ref, created_at from public.visa_applications order by created_at;
