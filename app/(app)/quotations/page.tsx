import { getContext, getStaffList, nameOf } from "@/lib/context";
import { listApplications } from "@/lib/queries";
import { ApplicationsTable } from "@/components/ApplicationsTable";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";

export default async function QuotationsPage({ searchParams }: { searchParams: { q?: string } }) {
  const ctx = await getContext();
  const [rows, staffList] = await Promise.all([
    listApplications(ctx, { has: "quotation", search: searchParams.q }),
    getStaffList(),
  ]);

  return (
    <>
      <PageHeader title="Quotations" description="Every quotation issued. Open one to convert it to an invoice." />
      <div className="space-y-4 px-4 py-6 md:px-8">
        <ListToolbar path="/quotations" search={searchParams.q} />
        <ApplicationsTable
          rows={rows}
          issuers={ctx.issuers}
          staffName={(e) => nameOf(staffList, e)}
          columns={["client", "trip", "brand", "consultant", "status", "total"]}
          document="quotation"
          empty="No quotations yet. Quote a lead from its application page."
        />
      </div>
    </>
  );
}
