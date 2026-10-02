import { formatDate, num } from "@/lib/format";
import type { Issuer } from "@/lib/issuers";
import type { Application, Client } from "@/lib/types";
import { balance, money } from "@/lib/vat";
import { BrandLogo } from "@/components/BrandLogo";

export type DocumentIssuer = Issuer & {
  website: string;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_iban: string | null;
  bank_swift: string | null;
};

type Props = {
  kind: "invoice" | "quotation";
  issuer: DocumentIssuer;
  app: Pick<
    Application,
    | "ref"
    | "quantity"
    | "product_name"
    | "service_charge"
    | "selling_price"
    | "taxable_amount"
    | "vat_amount"
    | "grand_total"
    | "invoice_number"
    | "invoice_date"
    | "quotation_number"
    | "quotation_date"
    | "travel_from"
    | "travel_to"
    | "terms"
  >;
  client: Pick<Client, "full_name" | "nationality" | "passport_no" | "phone" | "email" | "client_ref">;
  countryName: string;
  payments: { amount: number }[];
};

function Line({
  label,
  value,
  sub,
  strong,
}: {
  label: string;
  value: string;
  sub?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-6 py-1.5 ${sub ? "pl-4 text-xs text-navy/60" : "text-sm"} ${
        strong ? "border-t-2 border-navy pt-2.5 text-base font-extrabold" : ""
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/**
 * A quotation, tax invoice or invoice, laid out for A4.
 *
 * The rule the whole system turns on: the badge says TAX INVOICE and the VAT
 * lines appear only when the company is VAT-registered and has a TRN.
 */
export function DocumentView({ kind, issuer, app, client, countryName, payments }: Props) {
  const number = kind === "invoice" ? app.invoice_number : app.quotation_number;
  const date = kind === "invoice" ? app.invoice_date : app.quotation_date;

  const taxInvoice = issuer.vat_registered && issuer.trn !== null;
  const badge = kind === "quotation" ? "QUOTATION" : taxInvoice ? "TAX INVOICE" : "INVOICE";

  const people = app.quantity;
  const serviceTotal = num(app.service_charge) * people;
  const owed = balance(num(app.grand_total), payments.map((p) => ({ amount: num(p.amount) })));
  const paid = num(app.grand_total) - owed;

  return (
    <article className="mx-auto max-w-[210mm] border border-navy/10 bg-white px-8 py-10 shadow-sm sm:px-12 print:border-0 print:max-w-none print:px-0 print:py-0 print:shadow-none">
      {/* Issuer */}
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-navy/10 pb-6">
        <div>
          <BrandLogo
            slug={issuer.slug}
            tradeName={issuer.trade_name}
            accentColour={issuer.accent_colour}
            className="h-10"
          />
          <p className="mt-3 text-sm font-bold">{issuer.legal_name}</p>
          {issuer.trade_name !== issuer.legal_name && (
            <p className="text-xs text-navy/60">Trading as {issuer.trade_name}</p>
          )}
          <div className="mt-2 space-y-0.5 text-xs text-navy/70">
            {taxInvoice ? (
              <p>
                <span className="font-semibold">TRN</span> {issuer.trn}
              </p>
            ) : (
              issuer.licence_no && (
                <p>
                  <span className="font-semibold">Licence no.</span> {issuer.licence_no}
                </p>
              )
            )}
            {issuer.address && <p>{issuer.address}</p>}
            <p>{[issuer.email, issuer.phone, issuer.website].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <div className="text-right">
          <p
            className="inline-block rounded-md px-3 py-1 text-sm font-extrabold tracking-widest text-white"
            style={{ backgroundColor: issuer.accent_colour }}
          >
            {badge}
          </p>
          <dl className="mt-3 space-y-0.5 text-xs">
            <div>
              <dt className="inline text-navy/50">No. </dt>
              <dd className="inline font-bold">{number}</dd>
            </div>
            <div>
              <dt className="inline text-navy/50">Date </dt>
              <dd className="inline font-semibold">{formatDate(date)}</dd>
            </div>
            <div>
              <dt className="inline text-navy/50">Our ref </dt>
              <dd className="inline font-semibold">{app.ref}</dd>
            </div>
            {kind === "invoice" && app.quotation_number && (
              <div>
                <dt className="inline text-navy/50">Quotation </dt>
                <dd className="inline font-semibold">{app.quotation_number}</dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      {/* Client */}
      <section className="grid gap-6 border-b border-navy/10 py-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-navy/50">
            {kind === "quotation" ? "Prepared for" : "Bill to"}
          </p>
          <p className="mt-1 font-bold">{client.full_name}</p>
          <div className="mt-1 space-y-0.5 text-xs text-navy/70">
            {client.nationality && <p>{client.nationality}</p>}
            {client.passport_no && <p>Passport {client.passport_no}</p>}
            {client.phone && <p>{client.phone}</p>}
            {client.email && <p>{client.email}</p>}
            {client.client_ref && <p>Your ref {client.client_ref}</p>}
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-bold uppercase tracking-wide text-navy/50">Travel</p>
          <p className="mt-1 text-sm font-semibold">{countryName}</p>
          <p className="text-xs text-navy/70">
            {app.travel_from ? formatDate(app.travel_from) : "Dates to be confirmed"}
            {app.travel_to ? ` – ${formatDate(app.travel_to)}` : ""}
          </p>
        </div>
      </section>

      {/* Line */}
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-navy/20 text-left text-xs uppercase tracking-wide text-navy/50">
            <th className="pb-2 font-bold">Description</th>
            <th className="pb-2 text-right font-bold">Guests</th>
            <th className="pb-2 text-right font-bold">Unit price</th>
            <th className="pb-2 text-right font-bold">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-navy/10">
            <td className="py-3 font-semibold">{app.product_name}</td>
            <td className="py-3 text-right tabular-nums">{people}</td>
            <td className="py-3 text-right tabular-nums">{money(app.selling_price)}</td>
            <td className="py-3 text-right tabular-nums">{money(app.grand_total)}</td>
          </tr>
        </tbody>
      </table>

      {/* Totals */}
      <section className="mt-4 flex justify-end">
        <div className="w-full max-w-sm">
          <Line strong label="Total (AED)" value={money(app.grand_total)} />
          {taxInvoice && (
            <>
              <Line sub label="Includes service fees (incl. VAT)" value={money(serviceTotal)} />
              <Line sub label="Taxable amount" value={money(app.taxable_amount)} />
              <Line sub label="VAT 5%" value={money(app.vat_amount)} />
            </>
          )}
          {kind === "invoice" && (
            <>
              <Line label="Paid" value={money(paid)} />
              <Line label="Balance due" value={money(owed)} />
            </>
          )}
        </div>
      </section>

      {/* Bank */}
      {kind === "invoice" && issuer.bank_iban && (
        <section className="mt-8 rounded-lg bg-navy/[0.03] p-4 text-xs">
          <p className="font-bold uppercase tracking-wide text-navy/50">Bank transfer</p>
          <p className="mt-1">
            {issuer.bank_account_name} · {issuer.bank_name}
          </p>
          <p>
            IBAN {issuer.bank_iban}
            {issuer.bank_swift ? ` · SWIFT ${issuer.bank_swift}` : ""}
          </p>
        </section>
      )}

      {/* Terms */}
      {app.terms && (
        <section className="mt-8">
          <p className="text-xs font-bold uppercase tracking-wide text-navy/50">Terms and conditions</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-navy/70">
            {app.terms
              .split("\n")
              .map((t) => t.trim())
              .filter(Boolean)
              .map((t, i) => (
                <li key={i}>{t}</li>
              ))}
          </ul>
        </section>
      )}

      <footer className="mt-10 border-t border-navy/10 pt-4 text-center text-[11px] text-navy/50">
        {issuer.legal_name}
        {taxInvoice ? ` · TRN ${issuer.trn}` : issuer.licence_no ? ` · Licence ${issuer.licence_no}` : ""} ·
        Computer-generated document; no signature required.
      </footer>
    </article>
  );
}
