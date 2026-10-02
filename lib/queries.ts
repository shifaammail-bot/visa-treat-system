import { scopeApplications, type Context } from "@/lib/context";
import { num } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { APPLICATION_ROW_SELECT, type ApplicationRow, type Status } from "@/lib/types";
import { balance } from "@/lib/vat";

type ListOptions = {
  status?: Status[];
  /** Only applications with this document. */
  has?: "quotation" | "invoice";
  includeUnassigned?: boolean;
  search?: string;
  limit?: number;
};

/** Applications for a list page, scoped to the viewer and the sidebar brand. Newest first. */
export async function listApplications(ctx: Context, opts: ListOptions = {}): Promise<ApplicationRow[]> {
  let query = createAdminClient().from("visa_applications").select(APPLICATION_ROW_SELECT);
  query = scopeApplications(query, ctx, { includeUnassigned: opts.includeUnassigned });
  if (opts.status?.length) query = query.in("status", opts.status);
  if (opts.has === "quotation") query = query.not("quotation_number", "is", null);
  if (opts.has === "invoice") query = query.not("invoice_number", "is", null);

  const orderColumn = opts.has === "invoice" ? "invoice_number" : "created_at";
  const { data, error } = await query
    .order(orderColumn, { ascending: false })
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
