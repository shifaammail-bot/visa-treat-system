import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { canSeeClient, getContext, getStaffList, nameOf } from "@/lib/context";
import { can, canSeeApplication } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { APPLICATION_ROW_SELECT, type ApplicationRow, type Client } from "@/lib/types";
import { ApplicationsTable } from "@/components/ApplicationsTable";
import { Card, buttonClass, secondaryButtonClass } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { ClientForm } from "../ClientForm";

export default async function ClientPage({ params }: { params: { id: string } }) {
  const ctx = await getContext();
  const { staff } = ctx;
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();

  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("*").eq("id", params.id).maybeSingle<Client>();
  if (!client || !(await canSeeClient(staff, client))) notFound();

  const [{ data }, staffList] = await Promise.all([
    admin
      .from("visa_applications")
      .select(APPLICATION_ROW_SELECT)
      .eq("client_id", client.id)
      .order("created_at", { ascending: false }),
    getStaffList(),
  ]);
  const apps = ((data ?? []) as unknown as ApplicationRow[]).filter((a) => canSeeApplication(staff, a));

  return (
    <>
      <PageHeader
        title={client.full_name}
        description={[client.nationality, client.phone, client.email].filter(Boolean).join(" · ")}
        crumbs={[{ label: "Clients", href: "/clients" }]}
      >
        <div className="flex flex-wrap gap-2">
          {can.createLead(staff.role) && (
            <Link href={`/leads/new?client=${client.id}`} className={secondaryButtonClass}>
              <Plus className="h-4 w-4" />
              New lead
            </Link>
          )}
          {can.editSale(staff.role) && (
            <>
              <Link href={`/sales/new?type=quotation&client=${client.id}`} className={secondaryButtonClass}>
                <Plus className="h-4 w-4" />
                New quotation
              </Link>
              <Link href={`/sales/new?type=invoice&client=${client.id}`} className={buttonClass}>
                <Plus className="h-4 w-4" />
                New invoice
              </Link>
            </>
          )}
        </div>
      </PageHeader>
      <div className="space-y-6 px-4 py-6 md:px-8">
        <Card title={can.editClient(staff.role) ? "Details" : "Details (read-only)"}>
          <ClientForm client={client} readOnly={!can.editClient(staff.role)} />
        </Card>
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-navy/50">Applications</h2>
          <ApplicationsTable
            rows={apps}
            issuers={ctx.issuers}
            staffName={(e) => nameOf(staffList, e)}
            columns={["trip", "brand", "consultant", "status", "total", "balance"]}
            empty="No applications you can see."
          />
        </section>
      </div>
    </>
  );
}
