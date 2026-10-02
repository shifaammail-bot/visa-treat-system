import { dubaiDate, num } from "@/lib/format";
import type { Source, Status, VisaType } from "@/lib/types";
import { margin } from "@/lib/vat";

/**
 * Monthly profit target for the runway. Hardcoded for this phase; making it
 * editable needs a settings row and an admin screen (see the brief).
 */
export const MONTHLY_PROFIT_TARGET = 30_000;

export type SaleRow = {
  id: string;
  ref: string;
  created_at: string;
  consultant: string;
  issued_by: string | null;
  product_name: string;
  visa_type: VisaType | null;
  source: Source | null;
  quantity: number;
  government_fee: number;
  selling_price: number;
  cost_price: number;
  status: Status;
  invoice_number: string | null;
  invoice_date: string;
  client: { full_name: string } | null;
};

/**
 * A sale is an application that has been invoiced and not cancelled. Its sale
 * date is the invoice date — the date printed on the invoice.
 */
export const isSold = (r: SaleRow) => !!r.invoice_number && r.status !== "cancelled";

/** selling − cost − government fee, per person, times people: margin() in lib/vat.ts. */
export const profitOf = (r: SaleRow) =>
  margin(num(r.selling_price), num(r.cost_price), num(r.government_fee), r.quantity);

const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;

/** "2026-10" from a date or timestamp, in Dubai time. */
export const monthOf = (value: string) =>
  (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : dubaiDate(value)).slice(0, 7);

export const currentMonth = () => dubaiDate().slice(0, 7);

export const isMonth = (value?: string): value is string =>
  !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

export function monthLabel(month: string, style: "long" | "short" = "long") {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: style,
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function daysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** The `n` calendar months ending with `last`, oldest first. */
export function monthsEnding(last: string, n: number): string[] {
  const [y, m] = last.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export type MonthSummary = {
  month: string;
  leads: number;
  sales: SaleRow[];
  profit: number;
};

export function summariseMonth(rows: SaleRow[], month: string): MonthSummary {
  const sales = rows
    .filter((r) => isSold(r) && monthOf(r.invoice_date) === month)
    .sort((a, b) => a.invoice_date.localeCompare(b.invoice_date));
  return {
    month,
    leads: rows.filter((r) => monthOf(r.created_at) === month).length,
    sales,
    profit: sum(sales.map(profitOf)),
  };
}

/** ISO 8601 week number and week-year of a YYYY-MM-DD date. */
export function isoWeek(date: string): { year: number; week: number } {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay() || 7; // Monday = 1 … Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - day); // Thursday of this week decides the year
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return { year: d.getUTCFullYear(), week: Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7) };
}

export type WeekSummary = {
  week: number;
  year: number;
  /** First and last day of this ISO week that fall inside the month. */
  from: string;
  to: string;
  leads: number;
  sold: number;
  profit: number;
};

/**
 * The month split into ISO weeks. Weeks that straddle a month boundary only
 * count the days inside this month, so the weeks add up to the month.
 */
export function summariseWeeks(rows: SaleRow[], month: string): WeekSummary[] {
  const weeks: WeekSummary[] = [];
  for (let day = 1; day <= daysInMonth(month); day++) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const { year, week } = isoWeek(date);
    const last = weeks[weeks.length - 1];
    if (last && last.week === week && last.year === year) last.to = date;
    else weeks.push({ week, year, from: date, to: date, leads: 0, sold: 0, profit: 0 });
  }

  const weekOf = (date: string) => weeks.find((w) => date >= w.from && date <= w.to);
  for (const r of rows) {
    const created = weekOf(dubaiDate(r.created_at));
    if (created) created.leads += 1;
    if (isSold(r)) {
      const sold = weekOf(r.invoice_date);
      if (sold) {
        sold.sold += 1;
        sold.profit = Math.round((sold.profit + profitOf(r)) * 100) / 100;
      }
    }
  }
  return weeks;
}
