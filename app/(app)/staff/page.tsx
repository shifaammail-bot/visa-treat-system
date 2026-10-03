import { notFound } from "next/navigation";
import { getContext } from "@/lib/context";
import { getIssuers } from "@/lib/issuers";
import { can } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { money } from "@/lib/vat";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui";
import { CreateStaffForm, EditStaffForm, type StaffRow } from "./StaffForms";

const ROLE_LABEL = { super_admin: "Super admin", admin: "Admin", manager: "Manager", consultant: "Consultant", accounts: "Accounts" };

export default async function StaffPage() {
  const { staff: me } = await getContext();
  if (!can.manageStaff(me.role)) notFound();

  const issuers = (await getIssuers()).map((i) => ({ id: i.id, trade_name: i.trade_name }));
  const { data } = await createAdminClient()
    .from("staff")
    .select("email, full_name, role, issuer_ids, monthly_target, active")
    .order("active", { ascending: false })
    .order("full_name");
  const rows = (data ?? []) as StaffRow[];

  const brandsOf = (row: StaffRow) =>
    row.role !== "manager" || !row.issuer_ids
      ? "All brands"
      : issuers
          .filter((i) => row.issuer_ids!.includes(i.id))
          .map((i) => i.trade_name)
          .join(", ") || "No brands";

  return (
    <>
      <PageHeader title="Staff" description="Logins, roles and brands. Only admins see this page." />
      <div className="space-y-6 px-4 py-8 md:px-8">
        <Card title="Add a staff member">
          <CreateStaffForm issuers={issuers} />
        </Card>

        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy/50">
            {rows.length} staff
          </h2>
          <div className="mt-3 space-y-3">
            {rows.map((row) => (
              <details key={row.email} className="group rounded-xl border border-navy/10">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-5 py-4">
                  <div>
                    <p className={`font-bold ${row.active ? "" : "text-navy/40 line-through"}`}>
                      {row.full_name}
                    </p>
                    <p className="text-xs text-navy/50">{row.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-navy px-2 py-0.5 font-bold text-white">
                      {ROLE_LABEL[row.role]}
                    </span>
                    <span className="text-navy/60">{brandsOf(row)}</span>
                    {row.monthly_target !== null && (
                      <span className="text-navy/60">Target {money(row.monthly_target)}</span>
                    )}
                    {!row.active && <span className="font-bold text-red-600">Inactive</span>}
                    <span className="font-bold text-mint-600 group-open:hidden">Edit</span>
                  </div>
                </summary>
                <div className="border-t border-navy/10 px-5 py-4">
                  <EditStaffForm
                    row={row}
                    issuers={issuers}
                    isMe={row.email.toLowerCase() === me.email.toLowerCase()}
                  />
                </div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
