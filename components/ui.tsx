import Link from "next/link";
import { LEAD_STATUS_LABEL, STATUS_LABEL } from "@/lib/format";
import type { LeadStatus, Status } from "@/lib/types";

export const inputClass =
  "w-full rounded-lg border border-navy/15 bg-white px-3 py-2 text-sm focus:border-mint focus:outline-none focus:ring-2 focus:ring-mint/30 disabled:bg-navy/5 disabled:text-navy/60";

export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-mint px-4 py-2 text-sm font-bold text-navy hover:bg-mint-600 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-navy/15 bg-white px-4 py-2 text-sm font-bold text-navy hover:bg-navy/5 disabled:cursor-not-allowed disabled:opacity-50";

export const darkButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-50";

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-semibold">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-navy/50">{hint}</span>}
    </label>
  );
}

const STATUS_STYLE: Record<Status, string> = {
  enquiry: "bg-sky-50 text-sky-700 ring-sky-200",
  quoted: "bg-amber-50 text-amber-800 ring-amber-200",
  submitted: "bg-violet-50 text-violet-700 ring-violet-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  cancelled: "bg-navy/5 text-navy/50 ring-navy/10",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${STATUS_STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

const LEAD_STYLE: Record<LeadStatus, string> = {
  open: "bg-sky-50 text-sky-700 ring-sky-200",
  won: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  lost: "bg-navy/5 text-navy/50 ring-navy/10",
};

export function LeadBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${LEAD_STYLE[status]}`}>
      {LEAD_STATUS_LABEL[status]}
    </span>
  );
}

/** Paid in full, advance paid, or unpaid — from the total and what's been paid. */
export function PaymentBadge({ total, paid }: { total: number; paid: number }) {
  const [label, style] =
    paid <= 0
      ? ["Unpaid", "bg-red-50 text-red-700 ring-red-200"]
      : paid + 0.005 < total
        ? ["Advance paid", "bg-amber-50 text-amber-800 ring-amber-200"]
        : ["Paid", "bg-emerald-50 text-emerald-700 ring-emerald-200"];
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${style}`}>{label}</span>
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-navy/10 bg-white ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy/10 px-5 py-3">
          {title && <h2 className="text-sm font-bold">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "error" | "ok";
  children: React.ReactNode;
}) {
  const style = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warn: "border-amber-300 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-800",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
  }[tone];
  return <div className={`rounded-lg border px-4 py-3 text-sm ${style}`}>{children}</div>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-navy/20 px-6 py-10 text-center text-sm text-navy/60">
      {children}
    </div>
  );
}

/** A horizontal bar chart as a list: label, bar, value. */
export function BarList({
  rows,
  format = (n) => String(n),
}: {
  rows: { label: string; value: number; colour?: string }[];
  format?: (n: number) => string;
}) {
  if (rows.length === 0) return <p className="text-sm text-navy/50">Nothing in this period.</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="truncate font-semibold">{row.label}</span>
            <span className="shrink-0 tabular-nums text-navy/70">{format(row.value)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-navy/5">
            <div
              className="h-2 rounded-full"
              style={{
                width: `${Math.max((row.value / max) * 100, 2)}%`,
                backgroundColor: row.colour ?? "#2FE0C2",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-navy/10 p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-navy/50">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-navy/50">{sub}</p>}
    </div>
  );
}

export function TableLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-bold text-navy hover:text-mint-600 hover:underline">
      {children}
    </Link>
  );
}

/** Wraps a table so it scrolls sideways on phones instead of the page. */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-navy/10">
      <table className="w-full min-w-[720px] text-left text-sm">{children}</table>
    </div>
  );
}

export const thClass = "bg-navy/[0.03] px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-navy/50";
export const tdClass = "border-t border-navy/10 px-4 py-3 align-top";
