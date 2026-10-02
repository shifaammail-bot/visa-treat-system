import Link from "next/link";
import { Plus } from "lucide-react";
import { getContext, getStaffList } from "@/lib/context";
import { can } from "@/lib/permissions";
import { buildReport, thisMonth } from "@/lib/reports";
import { PageHeader } from "@/components/PageHeader";
import { ReportView } from "@/components/ReportView";
import { buttonClass, secondaryButtonClass } from "@/components/ui";

export default async function DashboardPage() {
  const ctx = await getContext();
  const [report, staffList] = await Promise.all([buildReport(ctx, thisMonth()), getStaffList()]);
  const firstName = ctx.staff.full_name.split(" ")[0];

  const scope = ctx.staff.role === "consultant" ? "Your leads and sales" : "All sales";

  return (
    <>
      <PageHeader title={`Welcome, ${firstName}`} description={`${scope} · this month`}>
        <div className="flex flex-wrap gap-2">
          {can.createLead(ctx.staff.role) && (
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
      <div className="px-4 py-6 md:px-8">
        <ReportView report={report} ctx={ctx} staffList={staffList} />
      </div>
    </>
  );
}
