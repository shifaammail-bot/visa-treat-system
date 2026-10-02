import { notFound } from "next/navigation";
import { loadApplication, requireStaff } from "@/lib/context";
import { getIssuers } from "@/lib/issuers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Client } from "@/lib/types";
import { DocumentView, type DocumentIssuer } from "@/components/DocumentView";
import Link from "next/link";
import { Breadcrumbs } from "@/components/PageHeader";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

type DocumentBank = Pick<DocumentIssuer, "website" | "bank_name" | "bank_account_name" | "bank_iban" | "bank_swift">;

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { type?: string; new?: string };
}) {
  const staff = await requireStaff();
  const app = await loadApplication(params.id, staff);
  const kind = searchParams.type === "invoice" ? "invoice" : "quotation";

  const number = kind === "invoice" ? app.invoice_number : app.quotation_number;
  if (!number || !app.issued_by) notFound();

  const issuer = (await getIssuers()).find((i) => i.id === app.issued_by);
  if (!issuer) notFound();

  const admin = createAdminClient();
  const [{ data: client }, { data: extra }, { data: payments }, { data: country }] = await Promise.all([
    admin.from("clients").select("*").eq("id", app.client_id).single<Client>(),
    admin
      .from("issuers")
      .select("bank_name, bank_account_name, bank_iban, bank_swift, website")
      .eq("id", issuer.id)
      .single<DocumentBank>(),
    admin.from("payments").select("amount").eq("application_id", app.id),
    admin.from("countries").select("name").eq("code", app.country_code).maybeSingle(),
  ]);

  if (!client) notFound();

  return (
    <div className="min-h-screen bg-[#F6F7F9] py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 max-w-[210mm] space-y-3 px-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumbs
            trail={[
              { label: "Dashboard", href: "/" },
              kind === "invoice"
                ? { label: "Invoices", href: "/invoices" }
                : { label: "Quotations", href: "/quotations" },
              { label: app.ref, href: `/applications/${app.id}` },
            ]}
            current={number}
          />
          <PrintButton />
        </div>
        {searchParams.new && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {kind === "invoice" ? "Invoice" : "Quotation"} <strong>{number}</strong> issued.{" "}
            <Link href={`/applications/${app.id}`} className="font-bold underline">
              Open the sale
            </Link>{" "}
            to record payments or update its status.
          </p>
        )}
      </div>

      <DocumentView
        kind={kind}
        issuer={{ ...issuer, ...(extra as DocumentBank) }}
        app={app}
        client={client}
        countryName={country?.name ?? app.country_code}
        payments={payments ?? []}
      />
    </div>
  );
}
