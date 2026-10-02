import { PLACEHOLDER_TERMS, getProducts } from "@/lib/catalogue";
import { getContext, getStaffList, loadApplication, nameOf } from "@/lib/context";
import {
  METHOD_LABEL,
  SOURCE_LABEL,
  VISA_TYPE_LABEL,
  dubaiDate,
  formatDate,
  num,
} from "@/lib/format";
import { getIssuers } from "@/lib/issuers";
import { can } from "@/lib/permissions";
import { NEXT_STATUS } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Client, Payment } from "@/lib/types";
import { balance, margin, money } from "@/lib/vat";
import { BrandLogo } from "@/components/BrandLogo";
import { PageHeader } from "@/components/PageHeader";
import { SaleSteps } from "@/components/SaleSteps";
import { Card, Notice, StatusBadge, TableLink } from "@/components/ui";
import { DocumentButtons, PaymentForm, StatusButtons } from "./Controls";
import { QuoteForm } from "./QuoteForm";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-navy/60">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  );
}

export default async function ApplicationPage({ params }: { params: { id: string } }) {
  const { staff, issuers: allowed } = await getContext();
  const app = await loadApplication(params.id, staff);
  const admin = createAdminClient();

  const [{ data: client }, { data: paymentRows }, { data: country }, products, staffList, allIssuers] =
    await Promise.all([
      admin.from("clients").select("*").eq("id", app.client_id).single<Client>(),
      admin.from("payments").select("*").eq("application_id", app.id).order("paid_at"),
      admin.from("countries").select("name").eq("code", app.country_code).maybeSingle(),
      getProducts(),
      getStaffList(),
      getIssuers(),
    ]);

  const payments = (paymentRows ?? []) as Payment[];
  const issuer = allIssuers.find((i) => i.id === app.issued_by) ?? null;
  const showCosts = can.seeCosts(staff.role);
  const editable = can.editSale(staff.role) && !app.invoice_number && app.status !== "cancelled";
  const owed = balance(num(app.grand_total), payments.map((p) => ({ amount: num(p.amount) })));
  const paid = num(app.grand_total) - owed;
  const ready = !!app.issued_by && num(app.grand_total) > 0;
  const taxInvoice = !!issuer && issuer.vat_registered && issuer.trn !== null;

  // Where this sale lives in the nav, for the breadcrumb and Back.
  const parent = app.invoice_number
    ? { label: "Invoices", href: "/invoices" }
    : app.quotation_number
      ? { label: "Quotations", href: "/quotations" }
      : app.status === "enquiry"
        ? { label: "Leads", href: "/leads" }
        : { label: "Applications", href: "/applications" };

  return (
    <>
      <PageHeader
        title={app.ref}
        meta={<StatusBadge status={app.status} />}
        description={`${client?.full_name ?? "Unknown client"} · ${app.product_name}`}
        crumbs={[parent]}
      >
        {issuer && (
          <BrandLogo slug={issuer.slug} tradeName={issuer.trade_name} accentColour={issuer.accent_colour} />
        )}
      </PageHeader>

      <div className="border-b border-navy/10 bg-[#FAFAFB] px-4 py-4 md:px-8">
        <SaleSteps
          direct={app.source === "direct"}
          quoted={ready}
          invoiced={!!app.invoice_number}
          paid={!!app.invoice_number && owed <= 0}
          submitted={!!app.submitted_at || ["submitted", "approved", "rejected"].includes(app.status)}
          decision={app.status === "approved" || app.status === "rejected" ? app.status : null}
          cancelled={app.status === "cancelled"}
        />
      </div>

      <div className="grid gap-6 px-4 py-6 md:px-8 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <Card title={app.invoice_number ? "Price (locked — invoiced)" : "Quote"}>
            {editable ? (
              <QuoteForm
                applicationId={app.id}
                countryCode={app.country_code}
                issuers={allowed.map((i) => ({
                  id: i.id,
                  trade_name: i.trade_name,
                  legal_name: i.legal_name,
                  taxInvoice: i.vat_registered && i.trn !== null,
                }))}
                products={products}
                showCosts={showCosts}
                initial={{
                  issued_by: app.issued_by,
                  product_id: app.product_id,
                  product_name: app.product_name,
                  quantity: app.quantity,
                  service_charge: num(app.service_charge),
                  selling_price: num(app.selling_price),
                  cost_price: showCosts ? num(app.cost_price) : null,
                  terms: app.terms ?? products.find((p) => p.id === app.product_id)?.terms ?? PLACEHOLDER_TERMS,
                }}
              />
            ) : (
              <dl className="divide-y divide-navy/5">
                <Row label="Company">{issuer ? `${issuer.trade_name} — ${issuer.legal_name}` : "Not chosen"}</Row>
                <Row label="Visa">{app.product_name}</Row>
                <Row label="Guests">{app.quantity}</Row>
                <Row label="Selling price per guest">{money(app.selling_price)}</Row>
                <Row label="Service fee per guest">{money(app.service_charge)}</Row>
                {taxInvoice && (
                  <>
                    <Row label="Taxable amount">{money(app.taxable_amount)}</Row>
                    <Row label="VAT 5%">{money(app.vat_amount)}</Row>
                  </>
                )}
                {showCosts && (
                  <>
                    <Row label="Cost per guest">{money(app.cost_price)}</Row>
                    <Row label="Profit">
                      {money(margin(num(app.selling_price), num(app.cost_price), num(app.government_fee), app.quantity))}
                    </Row>
                  </>
                )}
                <Row label="Total">{money(app.grand_total)}</Row>
              </dl>
            )}
          </Card>

          <Card title="Payments" action={<span className="text-sm font-bold">{owed > 0 ? `${money(owed)} owed` : ready ? "Paid in full" : ""}</span>}>
            {payments.length > 0 && (
              <ul className="mb-5 divide-y divide-navy/10 rounded-lg border border-navy/10">
                {payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div>
                      <p className="font-semibold">
                        {money(p.amount)} · {METHOD_LABEL[p.method]}
                      </p>
                      <p className="text-xs text-navy/50">
                        {formatDate(p.paid_at)}
                        {p.receipt_number ? ` · ${p.receipt_number}` : ""}
                        {p.reference ? ` · Ref ${p.reference}` : ""}
                        {p.received_by ? ` · ${nameOf(staffList, p.received_by)}` : ""}
                      </p>
                      {p.note && <p className="text-xs text-navy/60">{p.note}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <dl className="mb-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-navy/[0.03] p-3">
                <dt className="text-xs text-navy/50">Total</dt>
                <dd className="font-bold tabular-nums">{money(app.grand_total)}</dd>
              </div>
              <div className="rounded-lg bg-navy/[0.03] p-3">
                <dt className="text-xs text-navy/50">Paid</dt>
                <dd className="font-bold tabular-nums">{money(paid)}</dd>
              </div>
              <div className={`rounded-lg p-3 ${owed > 0 ? "bg-red-50" : "bg-emerald-50"}`}>
                <dt className="text-xs text-navy/50">Balance</dt>
                <dd className={`font-bold tabular-nums ${owed > 0 ? "text-red-700" : "text-emerald-700"}`}>
                  {money(owed)}
                </dd>
              </div>
            </dl>
            {app.status === "cancelled" ? (
              <p className="text-sm text-navy/50">Cancelled — no further payments.</p>
            ) : !ready ? (
              <p className="text-sm text-navy/50">Save a quote with a company and a price before taking payment.</p>
            ) : owed > 0 && can.recordPayment(staff.role) ? (
              <PaymentForm key={owed} id={app.id} owed={owed} today={dubaiDate()} />
            ) : null}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Documents">
            <DocumentButtons
              id={app.id}
              quotationNumber={app.quotation_number}
              invoiceNumber={app.invoice_number}
              canIssue={can.editSale(staff.role) && app.status !== "cancelled"}
              ready={ready}
            />
            {issuer && !taxInvoice && (
              <p className="mt-3 text-xs text-navy/60">
                {issuer.trade_name} has no TRN, so its documents are plain invoices with no VAT line.
              </p>
            )}
          </Card>

          {can.editSale(staff.role) && NEXT_STATUS[app.status].length > 0 && (
            <Card title="Status">
              <StatusButtons id={app.id} next={NEXT_STATUS[app.status]} />
            </Card>
          )}

          <Card
            title="Client"
            action={client && <TableLink href={`/clients/${client.id}`}>Open</TableLink>}
          >
            {client ? (
              <dl className="divide-y divide-navy/5">
                <Row label="Name">{client.full_name}</Row>
                <Row label="Nationality">{client.nationality}</Row>
                <Row label="Phone">{client.phone ?? "—"}</Row>
                <Row label="Email">{client.email ?? "—"}</Row>
                <Row label="Passport">{client.passport_no ?? "—"}</Row>
              </dl>
            ) : (
              <Notice tone="error">Client record missing.</Notice>
            )}
          </Card>

          <Card title={app.source === "direct" ? "Sale" : "Lead"}>
            <dl className="divide-y divide-navy/5">
              <Row label="Destination">{country?.name ?? app.country_code}</Row>
              <Row label="Visa type">{app.visa_type ? VISA_TYPE_LABEL[app.visa_type] : "—"}</Row>
              <Row label="Travel">
                {app.travel_from ? formatDate(app.travel_from) : "—"}
                {app.travel_to ? ` → ${formatDate(app.travel_to)}` : ""}
              </Row>
              <Row label="Source">{app.source ? SOURCE_LABEL[app.source] : "—"}</Row>
              <Row label="Consultant">{nameOf(staffList, app.consultant)}</Row>
              <Row label="Created">{formatDate(app.created_at)}</Row>
              {app.submitted_at && <Row label="Submitted">{formatDate(app.submitted_at)}</Row>}
              {app.decided_at && <Row label="Decided">{formatDate(app.decided_at)}</Row>}
            </dl>
            {app.notes && <p className="mt-3 whitespace-pre-line text-sm text-navy/70">{app.notes}</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
