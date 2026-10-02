import Link from "next/link";
import { Plus } from "lucide-react";
import { getContext, getStaffList, nameOf } from "@/lib/context";
import { can } from "@/lib/permissions";
import { listApplications } from "@/lib/queries";
import { ApplicationsTable } from "@/components/ApplicationsTable";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { buttonClass } from "@/components/ui";

export default async function QuotationsPage({ searchParams }: { searchParams: { q?: string } }) {
  const ctx = await getContext();
  const [rows, staffList] = await Promise.all([
    listApplications(ctx, { has: "quotation", search: searchParams.q }),
    getStaffList(),
  ]);

  return (
    <>
      <PageHeader title="Quotations" description="Every quotation issued. Open one to convert it to an invoice.">
        {can.editSale(ctx.staff.role) && (
          <Link href="/sales/new?type=quotation" className={buttonClass}>
            <Plus className="h-4 w-4" />
            New quotation
          </Link>
        )}
      </PageHeader>
      <div className="space-y-4 px-4 py-6 md:px-8">
        <ListToolbar path="/quotations" search={searchParams.q} />
        <ApplicationsTable
          rows={rows}
          issuers={ctx.issuers}
          staffName={(e) => nameOf(staffList, e)}
          columns={["client", "trip", "brand", "consultant", "status", "total"]}
          document="quotation"
          empty="No quotations yet. Use New quotation, or quote a lead from its page."
        />
      </div>
    </>
  );
}
