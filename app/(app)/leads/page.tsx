import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { getContext, getStaffList, nameOf } from "@/lib/context";
import { dubaiDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { listApplications } from "@/lib/queries";
import type { LeadStatus } from "@/lib/types";
import { LeadsTable } from "@/components/LeadsTable";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { buttonClass } from "@/components/ui";

type View = "due" | "open" | "won" | "lost" | "all";

const TABS: { label: string; value: View }[] = [
  { label: "Due today & overdue", value: "due" },
  { label: "Following up", value: "open" },
  { label: "Won", value: "won" },
  { label: "Lost", value: "lost" },
  { label: "All", value: "all" },
];

export default async function LeadsPage({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  const ctx = await getContext();
  if (!can.createLead(ctx.staff.role)) notFound();

  const view: View = TABS.some((t) => t.value === searchParams.status) ? (searchParams.status as View) : "due";
  const lead: LeadStatus[] | undefined = view === "open" || view === "won" || view === "lost" ? [view] : undefined;

  const [rows, staffList] = await Promise.all([
    listApplications(ctx, { lead, due: view === "due", search: searchParams.q }),
    getStaffList(),
  ]);

  return (
    <>
      <PageHeader
        title="Leads"
        description="Every enquiry from every channel and brand. Work the due list first; log each contact; issue the invoice when they go ahead."
      >
        <Link href="/leads/new" className={buttonClass}>
          <Plus className="h-4 w-4" />
          New lead
        </Link>
      </PageHeader>
      <div className="space-y-4 px-4 py-6 md:px-8">
        <ListToolbar
          path="/leads"
          search={searchParams.q}
          tabs={TABS.map((t) => ({ label: t.label, value: t.value === "due" ? "" : t.value }))}
          active={view === "due" ? "" : view}
        />
        <LeadsTable
          rows={rows}
          issuers={ctx.issuers}
          staffName={(e) => nameOf(staffList, e)}
          today={dubaiDate()}
          empty={
            view === "due" ? (
              <>Nothing due — every open lead has a follow-up date in the future.</>
            ) : (
              <>
                No leads here.{" "}
                <Link href="/leads/new" className="font-bold text-mint-600">
                  Add one
                </Link>
                .
              </>
            )
          }
        />
      </div>
    </>
  );
}
