import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { canSeeClient, getContext, getStaffList, nameOf } from "@/lib/context";
import { can, canSeeApplication } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { APPLICATION_ROW_SELECT, type ApplicationRow, type Client } from "@/lib/types";
import { ApplicationsTable } from "@/components/ApplicationsTable";
import { Card, buttonClass } from "@/components/ui";
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
      <header className="border-b border-navy/10 px-4 py-6 md:px-8">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 text-sm font-semibold text-navy/50 hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" />
          Clients
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-extrabold tracking-tight">{client.full_name}</h1>
          {can.createLead(staff.role) && (
            <Link href={`/leads/new?client=${client.id}`} className={buttonClass}>
              <Plus className="h-4 w-4" />
              New application
            </Link>
          )}
        </div>
      </header>
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
