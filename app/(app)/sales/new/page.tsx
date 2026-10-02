import { notFound } from "next/navigation";
import { PLACEHOLDER_TERMS, getCountries, getProducts } from "@/lib/catalogue";
import { canSeeClient, getContext, getStaffList } from "@/lib/context";
import { can } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/PageHeader";
import { SaleForm } from "../SaleForm";

export default async function NewSalePage({
  searchParams,
}: {
  searchParams: { type?: string; client?: string };
}) {
  const { staff, issuers } = await getContext();
  if (!can.editSale(staff.role)) notFound();
  const kind = searchParams.type === "quotation" ? "quotation" : "invoice";

  const [countries, products, staffList] = await Promise.all([getCountries(), getProducts(), getStaffList()]);

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

  return (
    <>
      <PageHeader
        title={kind === "invoice" ? "New invoice" : "New quotation"}
        crumbs={
          existingClient
            ? [
                { label: "Clients", href: "/clients" },
                { label: existingClient.full_name, href: `/clients/${existingClient.id}` },
              ]
            : kind === "invoice"
              ? [{ label: "Invoices", href: "/invoices" }]
              : [{ label: "Quotations", href: "/quotations" }]
        }
        description="A direct sale, issued in one step. Campaign enquiries go in Leads instead."
      />
      <div className="max-w-4xl px-4 py-8 md:px-8">
        <SaleForm
          kind={kind}
          countries={countries}
          issuers={issuers.map((i) => ({
            id: i.id,
            trade_name: i.trade_name,
            legal_name: i.legal_name,
            taxInvoice: i.vat_registered && i.trn !== null,
          }))}
          products={products}
          showCosts={can.seeCosts(staff.role)}
          consultants={
            can.assignConsultant(staff.role) ? staffList.filter((s) => s.active && s.role !== "accounts") : null
          }
          me={staff.email}
          existingClient={existingClient}
          defaultTerms={PLACEHOLDER_TERMS}
        />
      </div>
    </>
  );
}
