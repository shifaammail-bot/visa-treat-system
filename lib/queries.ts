import { scopeApplications, type Context } from "@/lib/context";
import { dubaiDate, num } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { APPLICATION_ROW_SELECT, type ApplicationRow, type LeadStatus, type Status } from "@/lib/types";
import { balance } from "@/lib/vat";

type ListOptions = {
  status?: Status[];
  /** Only applications with this document. */
  has?: "quotation" | "invoice";
  /** Only leads in these states. */
  lead?: LeadStatus[];
  /** Open leads whose follow-up is today or overdue. */
  due?: boolean;
  search?: string;
  limit?: number;
};

/** Applications for a list page, scoped to the viewer. Newest first. */
export async function listApplications(ctx: Context, opts: ListOptions = {}): Promise<ApplicationRow[]> {
  let query = createAdminClient().from("visa_applications").select(APPLICATION_ROW_SELECT);
  query = scopeApplications(query, ctx);
  if (opts.status?.length) query = query.in("status", opts.status);
  if (opts.has === "quotation") query = query.not("quotation_number", "is", null);
  if (opts.has === "invoice") query = query.not("invoice_number", "is", null);
  if (opts.lead?.length) query = query.in("lead_status", opts.lead);
  if (opts.due) query = query.eq("lead_status", "open").lte("next_follow_up", dubaiDate());

  // Leads being worked are ordered by who to call first; everything else newest first.
  const byFollowUp = opts.due || (opts.lead?.length === 1 && opts.lead[0] === "open");
  const orderColumn = byFollowUp ? "next_follow_up" : opts.has === "invoice" ? "invoice_date" : "created_at";
  const { data, error } = await query
    .order(orderColumn, { ascending: byFollowUp, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 500);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as ApplicationRow[];
  const q = opts.search?.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) =>
    [r.ref, r.client?.full_name, r.client?.phone, r.invoice_number, r.quotation_number, r.product_name]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q))
  );
}

export const paidOf = (row: { payments: { amount: number }[] }) =>
  row.payments.reduce((sum, p) => sum + num(p.amount), 0);

export const balanceOf = (row: { grand_total: number; payments: { amount: number }[] }) =>
  balance(num(row.grand_total), row.payments.map((p) => ({ amount: num(p.amount) })));
