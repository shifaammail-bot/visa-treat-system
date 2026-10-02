import { fetchAll, scopeApplications, type Context } from "@/lib/context";
import { SOURCE_LABEL, dubaiDate, num } from "@/lib/format";
import { balanceOf } from "@/lib/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Source, Status } from "@/lib/types";
import { margin } from "@/lib/vat";
import type { SaleRow } from "@/lib/profit";

type ReportApp = {
  id: string;
  ref: string;
  created_at: string;
  consultant: string;
  issued_by: string | null;
  product_name: string;
  quantity: number;
  government_fee: number;
  selling_price: number;
  cost_price: number;
  grand_total: number;
  status: Status;
  source: Source | null;
  invoice_number: string | null;
  invoice_date: string;
  client: { full_name: string } | null;
  payments: { amount: number }[];
};

const SELECT =
  "id, ref, created_at, consultant, issued_by, product_name, quantity, government_fee, selling_price, cost_price, grand_total, status, source, invoice_number, invoice_date, client:clients(full_name), payments(amount)";

export type Period = { from: string; to: string };

export function thisMonth(): Period {
  const today = dubaiDate();
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

type Group = { key: string; value: number; count: number };

function group<T>(rows: T[], key: (r: T) => string, value: (r: T) => number = () => 1): Group[] {
  const map = new Map<string, Group>();
  for (const row of rows) {
    const k = key(row);
    const g = map.get(k) ?? { key: k, value: 0, count: 0 };
    g.value += value(row);
    g.count += 1;
    map.set(k, g);
  }
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}

export type Report = Awaited<ReturnType<typeof buildReport>>;

/**
 * Everything the dashboard and reports show, for one period, scoped to the
 * viewer and the sidebar brand.
 *
 * - Leads: applications created in the period (Dubai date).
 * - Conversion: of those leads, the share that reached an invoice.
 * - Income: invoices dated in the period, excluding cancelled.
 * - Receivables: every live invoice with a balance, regardless of period.
 */
export async function buildReport(ctx: Context, period: Period) {
  const admin = createAdminClient();
  const rows = await fetchAll<ReportApp>((from, to) =>
    scopeApplications(admin.from("visa_applications").select(SELECT), ctx, { includeUnassigned: true })
      .order("created_at", { ascending: false })
      .range(from, to) as unknown as PromiseLike<{ data: ReportApp[] | null; error: { message: string } | null }>
  );

  const inPeriod = (d: string) => d >= period.from && d <= period.to;
  const leads = rows.filter((r) => inPeriod(dubaiDate(r.created_at)));
  const converted = leads.filter((r) => r.invoice_number && r.status !== "cancelled");
  const invoiced = rows.filter((r) => r.invoice_number && r.status !== "cancelled" && inPeriod(r.invoice_date));
  const receivables = rows
    .filter((r) => r.invoice_number && r.status !== "cancelled" && balanceOf(r) > 0)
    .map((r) => ({ ...r, owed: balanceOf(r) }))
    .sort((a, b) => b.owed - a.owed);

  const income = invoiced.reduce((s, r) => s + num(r.grand_total), 0);
  const marginTotal = invoiced.reduce(
    (s, r) => s + margin(num(r.selling_price), num(r.cost_price), num(r.government_fee), r.quantity),
    0
  );

  return {
    period,
    leadCount: leads.length,
    convertedCount: converted.length,
    conversion: leads.length ? converted.length / leads.length : 0,
    income,
    invoiceCount: invoiced.length,
    margin: marginTotal,
    outstanding: receivables.reduce((s, r) => s + r.owed, 0),
    receivables,
    bySource: group(leads, (r) => (r.source ? SOURCE_LABEL[r.source] : "Not recorded")),
    byStatus: group(leads, (r) => r.status),
    byBrand: group(invoiced, (r) => r.issued_by ?? "none", (r) => num(r.grand_total)),
    byConsultant: group(invoiced, (r) => r.consultant.toLowerCase(), (r) => num(r.grand_total)),
    visaMix: group(leads, (r) => r.product_name),
  };
}

const SALE_SELECT =
  "id, ref, created_at, consultant, issued_by, product_name, visa_type, source, quantity, government_fee, selling_price, cost_price, status, invoice_number, invoice_date, client:clients(full_name)";

/** Every application the viewer may see, for the sidebar brand. */
export async function loadSales(ctx: Context): Promise<SaleRow[]> {
  const admin = createAdminClient();
  return fetchAll<SaleRow>(
    (from, to) =>
      scopeApplications(admin.from("visa_applications").select(SALE_SELECT), ctx, { includeUnassigned: true })
        .order("created_at", { ascending: false })
        .range(from, to) as unknown as PromiseLike<{
        data: SaleRow[] | null;
        error: { message: string } | null;
      }>
  );
}
