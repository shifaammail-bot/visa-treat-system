import Link from "next/link";
import { Plus } from "lucide-react";
import { getContext, getStaffList, nameOf } from "@/lib/context";
import { SOURCE_LABEL, dubaiDate, formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { listApplications } from "@/lib/queries";
import { buildReport, thisMonth } from "@/lib/reports";
import { PageHeader } from "@/components/PageHeader";
import { ReportView } from "@/components/ReportView";
import { Card, TableLink, buttonClass, secondaryButtonClass } from "@/components/ui";

export default async function DashboardPage() {
  const ctx = await getContext();
  const seesLeads = can.createLead(ctx.staff.role);
  const [report, staffList, due] = await Promise.all([
    buildReport(ctx, thisMonth()),
    getStaffList(),
    seesLeads ? listApplications(ctx, { due: true, limit: 50 }) : Promise.resolve([]),
  ]);
  const firstName = ctx.staff.full_name.split(" ")[0];
  const today = dubaiDate();
  const scope = ctx.staff.role === "consultant" ? "Your leads and sales" : "All sales";

  return (
    <>
      <PageHeader home title={`Welcome, ${firstName}`} description={`${scope} · this month`}>
        <div className="flex flex-wrap gap-2">
          {seesLeads && (
            <Link href="/leads/new" className={secondaryButtonClass}>
              <Plus className="h-4 w-4" />
              New lead
            </Link>
          )}
          {can.editSale(ctx.staff.role) && (
            <>
              <Link href="/sales/new?type=quotation" className={secondaryButtonClass}>
                <Plus className="h-4 w-4" />
                New quotation
              </Link>
              <Link href="/sales/new?type=invoice" className={buttonClass}>
                <Plus className="h-4 w-4" />
                New invoice
              </Link>
            </>
          )}
        </div>
      </PageHeader>
      <div className="space-y-6 px-4 py-6 md:px-8">
        {seesLeads && (
          <Card
            title={due.length ? `Follow-ups due (${due.length})` : "Follow-ups due"}
            action={<TableLink href="/leads">All leads</TableLink>}
          >
            {due.length === 0 ? (
              <p className="text-sm text-navy/60">Nothing due today. Every open lead has a follow-up date ahead.</p>
            ) : (
              <ul className="divide-y divide-navy/10">
                {due.slice(0, 8).map((r) => {
                  const overdue = !!r.next_follow_up && r.next_follow_up < today;
                  return (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                      <div className="min-w-0">
                        <TableLink href={`/applications/${r.id}`}>{r.client?.full_name ?? "—"}</TableLink>
                        <p className="text-xs text-navy/50">
                          {r.country?.name ?? r.country_code} · {r.source ? SOURCE_LABEL[r.source] : "—"} ·{" "}
                          {nameOf(staffList, r.consultant)}
                          {r.client?.phone ? ` · ${r.client.phone}` : ""}
                        </p>
                      </div>
                      <span className={`text-xs font-bold ${overdue ? "text-red-600" : "text-amber-700"}`}>
                        {overdue ? `Overdue · ${formatDate(r.next_follow_up)}` : "Today"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {due.length > 8 && (
              <p className="mt-3 text-sm">
                <TableLink href="/leads">See all {due.length} due</TableLink>
              </p>
            )}
          </Card>
        )}
        <ReportView report={report} ctx={ctx} staffList={staffList} />
      </div>
    </>
  );
}
