import { getContext, getStaffList, nameOf } from "@/lib/context";
import { balanceOf, listApplications } from "@/lib/queries";
import { money } from "@/lib/vat";
import { num } from "@/lib/format";
import { ApplicationsTable } from "@/components/ApplicationsTable";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { Stat } from "@/components/ui";

export default async function InvoicesPage({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  const ctx = await getContext();
  const [all, staffList] = await Promise.all([
    listApplications(ctx, { has: "invoice", search: searchParams.q, limit: 1000 }),
    getStaffList(),
  ]);

  const unpaidOnly = searchParams.status === "unpaid";
  const rows = unpaidOnly ? all.filter((r) => r.status !== "cancelled" && balanceOf(r) > 0) : all;
  const live = all.filter((r) => r.status !== "cancelled");
  const invoiced = live.reduce((s, r) => s + num(r.grand_total), 0);
  const outstanding = live.reduce((s, r) => s + Math.max(balanceOf(r), 0), 0);

  return (
    <>
      <PageHeader title="Invoices" description="Every invoice issued, with what is still owed." />
      <div className="space-y-4 px-4 py-6 md:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Invoices" value={String(live.length)} sub="Excluding cancelled" />
          <Stat label="Invoiced" value={money(invoiced)} />
          <Stat label="Outstanding" value={money(outstanding)} />
        </div>
        <ListToolbar
          path="/invoices"
          search={searchParams.q}
          tabs={[
            { label: "All", value: "" },
            { label: "Unpaid", value: "unpaid" },
          ]}
          active={unpaidOnly ? "unpaid" : ""}
        />
        <ApplicationsTable
          rows={rows}
          issuers={ctx.issuers}
          staffName={(e) => nameOf(staffList, e)}
          columns={["client", "trip", "brand", "consultant", "status", "total", "balance"]}
          document="invoice"
          empty={unpaidOnly ? "Nothing outstanding." : "No invoices yet."}
        />
      </div>
    </>
  );
}
