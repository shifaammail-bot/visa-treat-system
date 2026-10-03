-- Visa Treat — 009: leads, follow-ups and channels (basic CRM)
--
-- Every enquiry is a lead. A lead stays open while the team follows up, and
-- closes as won (an invoice was issued) or lost (with a reason). Each contact
-- is logged as a follow-up with a note and the next follow-up date.
--
-- Also widens the channel list (referral, walk-in, repeat client, …).
--
-- Run the whole file in the Supabase SQL editor. Safe to run more than once.

-- 1. Lead state on the sale record
alter table public.visa_applications
  add column if not exists lead_status text not null default 'open',
  add column if not exists next_follow_up date,
  add column if not exists lost_reason text,
  add column if not exists closed_at date;

alter table public.visa_applications drop constraint if exists visa_applications_lead_status_check;
alter table public.visa_applications
  add constraint visa_applications_lead_status_check check (lead_status in ('open', 'won', 'lost'));

create index if not exists visa_applications_follow_up_idx
  on public.visa_applications (next_follow_up) where lead_status = 'open';

-- 2. Channels
alter table public.visa_applications drop constraint if exists visa_applications_source_check;
alter table public.visa_applications
  add constraint visa_applications_source_check
  check (source in ('google_ads', 'organic', 'social', 'whatsapp', 'referral', 'walk_in',
                    'repeat', 'agent', 'other', 'direct'));

-- 3. Existing records: invoiced = won, cancelled before invoicing = lost.
update public.visa_applications
   set lead_status = 'won', closed_at = coalesce(closed_at, invoice_date)
 where invoice_number is not null and lead_status = 'open';

update public.visa_applications
   set lead_status = 'lost', closed_at = coalesce(closed_at, (now() at time zone 'Asia/Dubai')::date),
       lost_reason = coalesce(lost_reason, 'Cancelled')
 where invoice_number is null and status = 'cancelled' and lead_status = 'open';

-- 4. The follow-up log
create table if not exists public.lead_followups (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.visa_applications(id) on delete cascade,
  created_at     timestamptz not null default now(),
  created_by     text references public.staff(email),
  -- How the client was contacted.
  method         text not null default 'call'
                 check (method in ('call', 'whatsapp', 'email', 'visit', 'other')),
  note           text not null,
  -- The date set for the next follow-up when this one was logged.
  next_follow_up date
);

alter table public.lead_followups enable row level security;
revoke all on public.lead_followups from anon;

create index if not exists lead_followups_application_idx
  on public.lead_followups (application_id, created_at);

notify pgrst, 'reload schema';

-- Check: leads by state.
select lead_status, count(*) from public.visa_applications group by lead_status order by 1;
