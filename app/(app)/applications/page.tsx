import { getContext, getStaffList, nameOf } from "@/lib/context";
import { STATUS_LABEL } from "@/lib/format";
import { listApplications } from "@/lib/queries";
import type { Status } from "@/lib/types";
import { ApplicationsTable } from "@/components/ApplicationsTable";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const ctx = await getContext();
  const status = searchParams.status && searchParams.status in STATUS_LABEL ? (searchParams.status as Status) : undefined;

  const [rows, staffList] = await Promise.all([
    listApplications(ctx, {
      status: status ? [status] : undefined,
      includeUnassigned: true,
      search: searchParams.q,
    }),
    getStaffList(),
  ]);

  const tabs = [
    { label: "All", value: "" },
    ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ label, value })),
  ];

  return (
    <>
      <PageHeader title="Applications" description="Every sale, from enquiry to decision." />
      <div className="space-y-4 px-4 py-6 md:px-8">
        <ListToolbar path="/applications" search={searchParams.q} tabs={tabs} active={status} />
        <ApplicationsTable
          rows={rows}
          issuers={ctx.issuers}
          staffName={(e) => nameOf(staffList, e)}
          columns={["client", "trip", "brand", "consultant", "status", "total", "balance"]}
          empty="No applications match."
        />
      </div>
    </>
  );
}
