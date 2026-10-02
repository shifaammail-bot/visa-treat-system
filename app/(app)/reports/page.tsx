import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext, getStaffList, nameOf } from "@/lib/context";
import { SOURCE_LABEL, VISA_TYPE_LABEL, dubaiDate, formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import {
  MONTHLY_PROFIT_TARGET,
  currentMonth,
  daysInMonth,
  isMonth,
  monthLabel,
  monthsEnding,
  profitOf,
  summariseMonth,
  summariseWeeks,
  type SaleRow,
} from "@/lib/profit";
import { loadSales } from "@/lib/reports";
import { money } from "@/lib/vat";
import { PageHeader } from "@/components/PageHeader";
import { MiniRunway, Runway } from "@/components/Runway";
import { Card, Empty, Stat, TableWrap, inputClass, secondaryButtonClass, tdClass, thClass } from "@/components/ui";

type View = "overview" | "monthly" | "weekly";

const TABS: { view: View; label: string }[] = [
  { view: "overview", label: "Overview" },
  { view: "monthly", label: "Monthly report" },
  { view: "weekly", label: "Weekly report" },
];

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** The status line under the runway, by how far through the month we are. */
function runwayMessage(profit: number, month: string): string {
  const left = MONTHLY_PROFIT_TARGET - profit;
  if (left <= 0) return `Cleared for takeoff — target beaten by ${money(-left)}.`;

  const today = dubaiDate();
  const isCurrent = today.startsWith(month);
  if (!isCurrent) return `${money(left)} short of target. This month has closed.`;

  const total = daysInMonth(month);
  const day = Number(today.slice(8, 10));
  const daysLeft = total - day + 1;
  const onPace = profit / MONTHLY_PROFIT_TARGET >= day / total;

  if (onPace) return `Ahead of schedule — ${money(left)} left before this month is cleared for takeoff.`;
  return `${money(left)} left before this month is cleared for takeoff — about ${money(
    left / daysLeft
  )} a day over the last ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`;
}

function MonthPicker({ view, month }: { view: View; month: string }) {
  return (
    <form className="flex items-end gap-2">
      <input type="hidden" name="view" value={view} />
      <label className="text-xs font-semibold">
        Month
        <input name="month" type="month" defaultValue={month} max={currentMonth()} className={`${inputClass} mt-1`} />
      </label>
      <button type="submit" className={secondaryButtonClass}>
        Show
      </button>
    </form>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { view?: string; month?: string };
}) {
  const ctx = await getContext();
  if (!can.seeReports(ctx.staff.role)) notFound();

  const view: View = TABS.some((t) => t.view === searchParams.view) ? (searchParams.view as View) : "overview";
  const month = isMonth(searchParams.month) && searchParams.month <= currentMonth() ? searchParams.month : currentMonth();

  const [rows, staffList] = await Promise.all([loadSales(ctx), getStaffList()]);
  const issuerName = (id: string | null) => ctx.issuers.find((i) => i.id === id)?.trade_name ?? "—";

  return (
    <>
      <PageHeader
        title="Reports"
        description={`All sales · profit target ${money(MONTHLY_PROFIT_TARGET)} a month`}
      >
        {view !== "overview" && <MonthPicker view={view} month={month} />}
      </PageHeader>

      <nav className="flex gap-1 border-b border-navy/10 px-4 md:px-8">
        {TABS.map((tab) => (
          <Link
            key={tab.view}
            href={tab.view === "overview" ? "/reports" : `/reports?view=${tab.view}&month=${month}`}
            className={`-mb-px border-b-2 px-3 py-3 text-sm font-bold ${
              view === tab.view ? "border-mint text-navy" : "border-transparent text-navy/50 hover:text-navy"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="space-y-6 px-4 py-6 md:px-8">
        {view === "overview" && <Overview rows={rows} />}

        {view === "monthly" &&
          (() => {
            const m = summariseMonth(rows, month);
            return (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Stat label="Leads received" value={String(m.leads)} sub={monthLabel(month)} />
                  <Stat
                    label="Applications sold"
                    value={String(m.sales.length)}
                    sub={`${m.fromLeads} from leads · ${m.sales.length - m.fromLeads} direct${
                      m.leads ? ` · ${pct(m.fromLeads / m.leads)} lead conversion` : ""
                    }`}
                  />
                  <Stat label="Profit" value={money(m.profit)} sub={`${pct(m.profit / MONTHLY_PROFIT_TARGET)} of target`} />
                </div>
                <Card>
                  <Runway
                    profit={m.profit}
                    target={MONTHLY_PROFIT_TARGET}
                    message={runwayMessage(m.profit, month)}
                    size="small"
                  />
                </Card>
                <section>
                  <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-navy/50">
                    Sales in {monthLabel(month)}
                  </h2>
                  {m.sales.length === 0 ? (
                    <Empty>No applications invoiced in {monthLabel(month)}.</Empty>
                  ) : (
                    <TableWrap>
                      <thead>
                        <tr>
                          <th className={thClass}>Invoice</th>
                          <th className={thClass}>Customer</th>
                          <th className={thClass}>Visa type</th>
                          <th className={thClass}>Source</th>
                          <th className={thClass}>Company</th>
                          <th className={thClass}>Consultant</th>
                          <th className={`${thClass} text-right`}>Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.sales.map((r) => {
                          const profit = profitOf(r);
                          return (
                            <tr key={r.id}>
                              <td className={tdClass}>
                                <Link href={`/applications/${r.id}`} className="font-bold hover:text-mint-600">
                                  {r.invoice_number}
                                </Link>
                                <p className="text-xs text-navy/50">{formatDate(r.invoice_date)}</p>
                              </td>
                              <td className={tdClass}>{r.client?.full_name ?? "—"}</td>
                              <td className={tdClass}>
                                <p>{r.visa_type ? VISA_TYPE_LABEL[r.visa_type] : "—"}</p>
                                <p className="text-xs text-navy/50">{r.product_name}</p>
                              </td>
                              <td className={tdClass}>{r.source ? SOURCE_LABEL[r.source] : "—"}</td>
                              <td className={tdClass}>{issuerName(r.issued_by)}</td>
                              <td className={tdClass}>{nameOf(staffList, r.consultant)}</td>
                              <td
                                className={`${tdClass} text-right font-semibold tabular-nums ${
                                  profit < 0 ? "text-red-600" : ""
                                }`}
                              >
                                {money(profit)}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="font-bold">
                          <td className={tdClass} colSpan={6}>
                            Total
                          </td>
                          <td className={`${tdClass} text-right tabular-nums`}>{money(m.profit)}</td>
                        </tr>
                      </tbody>
                    </TableWrap>
                  )}
                </section>
              </>
            );
          })()}

        {view === "weekly" &&
          (() => {
            const weeks = summariseWeeks(rows, month);
            const totals = weeks.reduce(
              (t, w) => ({ leads: t.leads + w.leads, sold: t.sold + w.sold, profit: t.profit + w.profit }),
              { leads: 0, sold: 0, profit: 0 }
            );
            return (
              <>
                <p className="text-sm text-navy/60">
                  {monthLabel(month)} by ISO week. Weeks that cross into the next or previous month only count
                  the days inside {monthLabel(month, "short")}, so the rows add up to the month.
                </p>
                <TableWrap>
                  <thead>
                    <tr>
                      <th className={thClass}>Week</th>
                      <th className={thClass}>Days</th>
                      <th className={`${thClass} text-right`}>Leads</th>
                      <th className={`${thClass} text-right`}>Sold</th>
                      <th className={`${thClass} text-right`}>Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeks.map((w) => (
                      <tr key={`${w.year}-${w.week}`}>
                        <td className={`${tdClass} font-bold`}>Week {w.week}</td>
                        <td className={tdClass}>
                          {formatDate(w.from)}
                          {w.to !== w.from ? ` – ${formatDate(w.to)}` : ""}
                        </td>
                        <td className={`${tdClass} text-right tabular-nums`}>{w.leads}</td>
                        <td className={`${tdClass} text-right tabular-nums`}>{w.sold}</td>
                        <td className={`${tdClass} text-right tabular-nums`}>{money(w.profit)}</td>
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td className={tdClass} colSpan={2}>
                        {monthLabel(month)}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>{totals.leads}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{totals.sold}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{money(totals.profit)}</td>
                    </tr>
                  </tbody>
                </TableWrap>
              </>
            );
          })()}
      </div>
    </>
  );
}

function Overview({ rows }: { rows: SaleRow[] }) {
  const month = currentMonth();
  const now = summariseMonth(rows, month);
  const history = monthsEnding(month, 12).map((m) => summariseMonth(rows, m));

  return (
    <>
      <Card>
        <p className="text-xs font-bold uppercase tracking-wide text-navy/50">
          {monthLabel(month)} · profit to target
        </p>
        <div className="mt-3">
          <Runway profit={now.profit} target={MONTHLY_PROFIT_TARGET} message={runwayMessage(now.profit, month)} />
        </div>
        <p className="mt-6 text-xs text-navy/50">
          Profit per sale is selling price − cost price − government fee, for every application invoiced this
          month ({now.sales.length} so far). Cancelled applications don&apos;t count.
        </p>
      </Card>

      <details className="group rounded-xl border border-navy/10">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-bold">
          <span className="group-open:hidden">View 12-month history</span>
          <span className="hidden group-open:inline">Hide 12-month history</span>
          <span className="text-xs font-semibold text-navy/50">
            {history.filter((h) => h.profit >= MONTHLY_PROFIT_TARGET).length} of 12 months hit target
          </span>
        </summary>
        <div className="space-y-2.5 border-t border-navy/10 px-5 py-4">
          {history.map((h) => (
            <MiniRunway
              key={h.month}
              label={monthLabel(h.month, "short")}
              profit={h.profit}
              target={MONTHLY_PROFIT_TARGET}
            />
          ))}
        </div>
      </details>
    </>
  );
}
