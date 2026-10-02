-- Visa Treat — 004: Visa Treat invoices continue from 2888
--
-- The next Visa Treat invoice will be VT-INV-2888. Only the Visa Treat
-- invoice series changes; quotations, receipts and the other companies are
-- untouched.
--
-- If the counter is already past 2888 it is left alone, so numbers can never
-- go backwards or repeat. Safe to run more than once.

insert into public.document_counters (issuer_id, series, next)
select id, 'invoice', 2888
  from public.issuers
 where slug = 'visatreat'
on conflict (issuer_id, series)
do update set next = greatest(public.document_counters.next, excluded.next);

-- Check: should show visatreat | invoice | 2888 (or higher).
select i.slug, c.series, c.next
  from public.document_counters c
  join public.issuers i on i.id = c.issuer_id
 order by i.sort_order, c.series;
