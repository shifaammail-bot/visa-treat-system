import { notFound } from "next/navigation";
import { getCountries } from "@/lib/catalogue";
import { canSeeClient, getContext, getStaffList } from "@/lib/context";
import { dubaiDate, dubaiDatePlus } from "@/lib/format";
import { can } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/PageHeader";
import { LeadForm } from "../LeadForm";

export default async function NewLeadPage({ searchParams }: { searchParams: { client?: string } }) {
  const { staff, issuers } = await getContext();
  if (!can.createLead(staff.role)) notFound();

  const [countries, staffList] = await Promise.all([getCountries(), getStaffList()]);

  // "New application" from a client page: reuse that client.
  let existingClient = null;
  if (searchParams.client && /^[0-9a-f-]{36}$/i.test(searchParams.client)) {
    const { data } = await createAdminClient()
      .from("clients")
      .select("id, created_by, full_name, nationality, phone")
      .eq("id", searchParams.client)
      .maybeSingle();
    if (!data || !(await canSeeClient(staff, data))) notFound();
    existingClient = data;
  }

  const consultants = can.assignConsultant(staff.role)
    ? staffList.filter((s) => s.active && s.role !== "accounts")
    : null;

  return (
    <>
      <PageHeader
        title="New lead"
        crumbs={
          existingClient
            ? [
                { label: "Clients", href: "/clients" },
                { label: existingClient.full_name, href: `/clients/${existingClient.id}` },
              ]
            : [{ label: "Leads", href: "/leads" }]
        }
        description="Every enquiry goes here, from any channel or brand. Follow up from the lead's page; issue an invoice when they go ahead."
      />
      <div className="max-w-3xl px-4 py-8 md:px-8">
        <LeadForm
          countries={countries}
          consultants={consultants}
          me={staff.email}
          existingClient={existingClient}
          brands={issuers.map((i) => ({ id: i.id, trade_name: i.trade_name }))}
          today={dubaiDate()}
          tomorrow={dubaiDatePlus(1)}
        />
      </div>
    </>
  );
}
