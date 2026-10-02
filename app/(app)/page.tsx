import { getSession } from "@/lib/auth";
import { ALL_BRANDS, allowedIssuers, getIssuers, selectedBrand } from "@/lib/issuers";
import { BrandLogo } from "@/components/BrandLogo";
import { PageHeader } from "@/components/PageHeader";

export default async function DashboardPage() {
  const session = await getSession();
  if (session.status !== "ok") return null;

  const issuers = allowedIssuers(await getIssuers(), session.staff);
  const brand = selectedBrand(issuers);
  const shown = brand === ALL_BRANDS ? issuers : issuers.filter((i) => i.id === brand);
  const firstName = session.staff.full_name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName}`}
        description={
          brand === ALL_BRANDS ? "Showing all brands" : `Showing ${shown[0]?.trade_name}`
        }
      />
      <div className="px-4 py-8 md:px-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-navy/50">
          Issuing companies
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((issuer) => {
            const taxInvoice = issuer.vat_registered && issuer.trn !== null;
            return (
              <div key={issuer.id} className="rounded-xl border border-navy/10 p-5">
                <div className="flex h-8 items-center">
                  <BrandLogo
                    slug={issuer.slug}
                    tradeName={issuer.trade_name}
                    accentColour={issuer.accent_colour}
                  />
                </div>
                <p className="mt-3 text-sm font-semibold">{issuer.legal_name}</p>
                <dl className="mt-3 space-y-1 text-sm text-navy/70">
                  <div className="flex justify-between gap-4">
                    <dt>{taxInvoice ? "TRN" : "Licence"}</dt>
                    <dd className="font-mono text-navy">
                      {taxInvoice ? issuer.trn : issuer.licence_no ?? "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Documents</dt>
                    <dd className="font-semibold text-navy">
                      {taxInvoice ? "Tax invoice" : "Invoice (no VAT)"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Number prefix</dt>
                    <dd className="font-mono text-navy">{issuer.invoice_prefix}</dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
        <p className="mt-8 text-sm text-navy/50">
          Leads, conversion, income and receivables arrive in build step 7.
        </p>
      </div>
    </>
  );
}
