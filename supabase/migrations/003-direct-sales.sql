-- Visa Treat — 003: direct sales
--
-- A direct sale (walk-in, phone, repeat customer) is invoiced or quoted on the
-- spot without first being a campaign lead. It is marked source = 'direct' so
-- lead counts and conversion rates only count real campaign leads.
--
-- Run the whole file in the Supabase SQL editor. Safe to run more than once.

alter table public.visa_applications
  drop constraint if exists visa_applications_source_check;

alter table public.visa_applications
  add constraint visa_applications_source_check
  check (source in ('google_ads', 'organic', 'whatsapp', 'social', 'agent', 'other', 'direct'));

notify pgrst, 'reload schema';
