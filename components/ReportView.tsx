import type { Context, StaffName } from "@/lib/context";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { Report } from "@/lib/reports";
import { money } from "@/lib/vat";
import { BarList, Card, Stat, TableLink, TableWrap, tdClass, thClass } from "@/components/ui";

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** The figures shared by the dashboard and the reports page. */
export function ReportView({
  report,
  ctx,
  staffList,
  detailed = false,
}: {
  report: Report;
  ctx: Context;
  staffList: StaffName[];
  detailed?: boolean;
}) {
  const showMargin = can.seeCosts(ctx.staff.role);
  const showConsultants = ctx.staff.role !== "consultant";
  const staffByEmail = new Map(staffList.map((s) => [s.email.toLowerCase(), s]));
  const issuerOf = (id: string) => ctx.issuers.find((i) => i.id === id);

  return (
    <div className="space-y-6">
      <div className={`grid gap-4 sm:grid-cols-2 ${showMargin ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
        <Stat label="Leads" value={String(report.leadCount)} sub={`${formatDate(report.period.from)} – ${formatDate(report.period.to)}`} />
        <Stat label="Conversion" value={pct(report.conversion)} sub={`${report.convertedCount} of ${report.leadCount} invoiced`} />
        <Stat label="Income" value={money(report.income)} sub={`${report.invoiceCount} invoices`} />
        {showMargin && <Stat label="Margin" value={money(report.margin)} sub="Selling − cost − government fee" />}
        <Stat label="Outstanding" value={money(report.outstanding)} sub={`${report.receivables.length} unpaid invoices, all time`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Leads by source">
          <BarList rows={report.bySource.map((g) => ({ label: g.key, value: g.value }))} />
        </Card>

        <Card title="Income by brand">
          <BarList
            format={money}
            rows={report.byBrand.map((g) => {
              const issuer = issuerOf(g.key);
              return {
                label: issuer?.trade_name ?? "Other",
                value: g.value,
                colour: issuer?.accent_colour,
              };
            })}
          />
        </Card>

        {showConsultants && (
          <Card title="Income by consultant">
            <BarList
              format={money}
              rows={report.byConsultant.map((g) => ({
                label: staffByEmail.get(g.key)?.full_name ?? g.key,
                value: g.value,
              }))}
            />
          </Card>
        )}

        <Card title="Visa type mix">
          <BarList rows={report.visaMix.slice(0, 8).map((g) => ({ label: g.key, value: g.value }))} />
        </Card>
      </div>

      {detailed && showConsultants && (
        <Card title="Consultants">
          <TableWrap>
            <thead>
              <tr>
                <th className={thClass}>Consultant</th>
                <th className={`${thClass} text-right`}>Leads</th>
                <th className={`${thClass} text-right`}>Invoices</th>
                <th className={`${thClass} text-right`}>Income</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(
                new Set([...report.leadsByConsultant.map((g) => g.key), ...report.byConsultant.map((g) => g.key)])
              ).map((email) => {
                const income = report.byConsultant.find((g) => g.key === email);
                return (
                  <tr key={email}>
                    <td className={tdClass}>{staffByEmail.get(email)?.full_name ?? email}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {report.leadsByConsultant.find((g) => g.key === email)?.count ?? 0}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>{income?.count ?? 0}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{money(income?.value ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        </Card>
      )}

      <Card title="Outstanding receivables">
        {report.receivables.length === 0 ? (
          <p className="text-sm text-navy/50">Nothing owed.</p>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th className={thClass}>Invoice</th>
                <th className={thClass}>Client</th>
                <th className={thClass}>Brand</th>
                <th className={`${thClass} text-right`}>Total</th>
                <th className={`${thClass} text-right`}>Owed</th>
              </tr>
            </thead>
            <tbody>
              {report.receivables.slice(0, detailed ? 200 : 8).map((r) => (
                <tr key={r.id}>
                  <td className={tdClass}>
                    <TableLink href={`/applications/${r.id}`}>{r.invoice_number}</TableLink>
                    <p className="text-xs text-navy/50">{formatDate(r.invoice_date)}</p>
                  </td>
                  <td className={tdClass}>{r.client?.full_name ?? "—"}</td>
                  <td className={tdClass}>{r.issued_by ? issuerOf(r.issued_by)?.trade_name ?? "Other" : "—"}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{money(r.grand_total)}</td>
                  <td className={`${tdClass} text-right font-semibold tabular-nums text-red-600`}>{money(r.owed)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
