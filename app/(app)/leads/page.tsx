import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { getContext, getStaffList, nameOf } from "@/lib/context";
import { can } from "@/lib/permissions";
import { listApplications } from "@/lib/queries";
import { ApplicationsTable } from "@/components/ApplicationsTable";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { buttonClass } from "@/components/ui";

export default async function LeadsPage({ searchParams }: { searchParams: { q?: string } }) {
  const ctx = await getContext();
  if (!can.createLead(ctx.staff.role)) notFound();

  const [rows, staffList] = await Promise.all([
    listApplications(ctx, { status: ["enquiry"], includeUnassigned: true, search: searchParams.q }),
    getStaffList(),
  ]);

  return (
    <>
      <PageHeader title="Leads" description="Enquiries not yet quoted.">
        <Link href="/leads/new" className={buttonClass}>
          <Plus className="h-4 w-4" />
          New lead
        </Link>
      </PageHeader>
      <div className="space-y-4 px-4 py-6 md:px-8">
        <ListToolbar path="/leads" search={searchParams.q} />
        <ApplicationsTable
          rows={rows}
          issuers={ctx.issuers}
          staffName={(e) => nameOf(staffList, e)}
          columns={["client", "trip", "consultant", "status"]}
          empty={
            <>
              No open leads.{" "}
              <Link href="/leads/new" className="font-bold text-mint-600">
                Add one
              </Link>
              .
            </>
          }
        />
      </div>
    </>
  );
}
