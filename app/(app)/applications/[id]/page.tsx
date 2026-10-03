import { PLACEHOLDER_TERMS, getCountries, getProducts } from "@/lib/catalogue";
import {
  getContext,
  getStaffList,
  loadApplication,
  nameOf,
} from "@/lib/context";
import {
  METHOD_LABEL,
  SOURCE_LABEL,
  VISA_TYPE_LABEL,
  dubaiDate,
  dubaiDatePlus,
  formatDate,
  num,
} from "@/lib/format";
import { getIssuers } from "@/lib/issuers";
import { can } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Client, FollowUp, Payment } from "@/lib/types";
import { balance, margin, money } from "@/lib/vat";
import { BrandLogo } from "@/components/BrandLogo";
import { PageHeader } from "@/components/PageHeader";
import { SaleSteps } from "@/components/SaleSteps";
import { Card, LeadBadge, Notice, TableLink } from "@/components/ui";
import { DocumentButtons, PaymentForm } from "./Controls";
import { FollowUps } from "./FollowUps";
import { DetailsForm, PaymentEditor } from "./EditControls";
import { QuoteForm } from "./QuoteForm";

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-navy/60">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  );
}

export default async function ApplicationPage({
  params,
}: {
  params: { id: string };
}) {
  const { staff, issuers: allowed } = await getContext();
  const app = await loadApplication(params.id, staff);
  const admin = createAdminClient();

  const [
    { data: client },
    { data: paymentRows },
    { data: country },
    products,
    staffList,
    allIssuers,
  ] = await Promise.all([
    admin.from("clients").select("*").eq("id", app.client_id).single<Client>(),
    admin
      .from("payments")
      .select("*")
      .eq("application_id", app.id)
      .order("paid_at"),
    admin
      .from("countries")
      .select("name")
      .eq("code", app.country_code)
      .maybeSingle(),
    getProducts(),
    getStaffList(),
    getIssuers(),
  ]);
  const [countries, { data: followUpRows }] = await Promise.all([
    getCountries(),
    admin
      .from("lead_followups")
      .select("*")
      .eq("application_id", app.id)
      .order("created_at"),
  ]);
  const followUps = (followUpRows ?? []) as FollowUp[];

  const payments = (paymentRows ?? []) as Payment[];
  const issuer = allIssuers.find((i) => i.id === app.issued_by) ?? null;
  const showCosts = can.seeCosts(staff.role);
  // Admins can correct anything on any sale; others edit until it's invoiced.
  const isAdmin = can.editIssuedInvoice(staff.role);
  const adminEditingInvoice = !!app.invoice_number && isAdmin;
  const editable =
    can.editSale(staff.role) &&
    (isAdmin || (app.status !== "cancelled" && !app.invoice_number));
  const owed = balance(
    num(app.grand_total),
    payments.map((p) => ({ amount: num(p.amount) })),
  );
  const paid = num(app.grand_total) - owed;
  const ready = !!app.issued_by && num(app.grand_total) > 0;
  const taxInvoice = !!issuer && issuer.vat_registered && issuer.trn !== null;

  // Where this sale lives in the nav, for the breadcrumb and Back.
  const parent = app.invoice_number
    ? { label: "Invoices", href: "/invoices" }
    : { label: "Leads", href: "/leads" };

  return (
    <>
      <PageHeader
        title={app.ref}
        meta={<LeadBadge status={app.lead_status} />}
        description={`${client?.full_name ?? "Unknown client"} · ${app.product_name}`}
        crumbs={[parent]}
      >
        {issuer && (
          <BrandLogo
            slug={issuer.slug}
            tradeName={issuer.trade_name}
            accentColour={issuer.accent_colour}
          />
        )}
      </PageHeader>

      <div className="border-b border-navy/10 bg-[#FAFAFB] px-4 py-4 md:px-8">
        <SaleSteps
          channel={app.source ? SOURCE_LABEL[app.source] : "Not recorded"}
          followUps={followUps.length}
          invoiced={!!app.invoice_number}
          paid={!!app.invoice_number && owed <= 0}
          advance={paid > 0 && owed > 0}
          lost={app.lead_status === "lost"}
        />
      </div>

      <div className="grid gap-6 px-4 py-6 md:px-8 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {(!app.invoice_number || followUps.length > 0) && (
            <Card title="Follow-ups">
              <FollowUps
                id={app.id}
                leadStatus={app.lead_status}
                nextFollowUp={app.next_follow_up}
                lostReason={app.lost_reason}
                closedAt={app.closed_at}
                createdAt={app.created_at}
                firstNote={app.notes}
                followUps={followUps.map((f) => ({ ...f, by: nameOf(staffList, f.created_by) }))}
                canEdit={can.editSale(staff.role)}
                today={dubaiDate()}
                inTwoDays={dubaiDatePlus(2)}
              />
            </Card>
          )}

          <Card
            title={
              app.invoice_number
                ? adminEditingInvoice
                  ? `Invoice ${app.invoice_number} — admin edit`
                  : "Price (locked — invoiced)"
                : "Price — fill in when they go ahead"
            }
          >
            {adminEditingInvoice && editable && (
              <div className="mb-5">
                <Notice tone="warn">
                  You&apos;re editing an issued invoice as an admin. Changes
                  show on the PDF straight away. The number, dates and status
                  are under Sale details. Each edit records your name and the
                  time.
                  {app.edited_at && (
                    <>
                      {" "}
                      Last edited by{" "}
                      <strong>
                        {nameOf(staffList, app.edited_by ?? null)}
                      </strong>{" "}
                      on {formatDate(app.edited_at)}.
                    </>
                  )}
                </Notice>
              </div>
            )}
            {editable ? (
              <QuoteForm
                applicationId={app.id}
                invoiceNumber={app.invoice_number}
                lockIssuer={!isAdmin && !!app.invoice_number}
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
                  terms:
                    app.terms ??
                    products.find((p) => p.id === app.product_id)?.terms ??
                    PLACEHOLDER_TERMS,
                }}
              />
            ) : (
              <dl className="divide-y divide-navy/5">
                <Row label="Company">
                  {issuer
                    ? `${issuer.trade_name} — ${issuer.legal_name}`
                    : "Not chosen"}
                </Row>
                <Row label="Visa">{app.product_name}</Row>
                <Row label="Guests">{app.quantity}</Row>
                <Row label="Selling price per guest">
                  {money(app.selling_price)}
                </Row>
                <Row label="Service fee per guest">
                  {money(app.service_charge)}
                </Row>
                {taxInvoice && (
                  <>
                    <Row label="Taxable amount">
                      {money(app.taxable_amount)}
                    </Row>
                    <Row label="VAT 5%">{money(app.vat_amount)}</Row>
                  </>
                )}
                {showCosts && (
                  <>
                    <Row label="Cost per guest">{money(app.cost_price)}</Row>
                    <Row label="Profit">
                      {money(
                        margin(
                          num(app.selling_price),
                          num(app.cost_price),
                          num(app.government_fee),
                          app.quantity,
                        ),
                      )}
                    </Row>
                  </>
                )}
                <Row label="Total">{money(app.grand_total)}</Row>
              </dl>
            )}
          </Card>

          <Card
            title="Payments"
            action={
              <span className="text-sm font-bold">
                {owed > 0
                  ? `${money(owed)} owed`
                  : owed < 0
                    ? `${money(-owed)} refund due`
                    : ready
                      ? "Paid in full"
                      : ""}
              </span>
            }
          >
            {payments.length > 0 && (
              <ul className="mb-5 divide-y divide-navy/10 rounded-lg border border-navy/10">
                {payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold">
                        {money(p.amount)} · {METHOD_LABEL[p.method]}
                      </p>
                      <p className="text-xs text-navy/50">
                        {formatDate(p.paid_at)}
                        {p.receipt_number ? ` · ${p.receipt_number}` : ""}
                        {p.reference ? ` · Ref ${p.reference}` : ""}
                        {p.received_by
                          ? ` · ${nameOf(staffList, p.received_by)}`
                          : ""}
                      </p>
                      {p.note && (
                        <p className="text-xs text-navy/60">{p.note}</p>
                      )}
                    </div>
                    {isAdmin && <PaymentEditor id={app.id} payment={p} />}
                  </li>
                ))}
              </ul>
            )}
            <dl className="mb-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-navy/[0.03] p-3">
                <dt className="text-xs text-navy/50">Total</dt>
                <dd className="font-bold tabular-nums">
                  {money(app.grand_total)}
                </dd>
              </div>
              <div className="rounded-lg bg-navy/[0.03] p-3">
                <dt className="text-xs text-navy/50">{paid > 0 && owed > 0 ? "Advance paid" : "Paid"}</dt>
                <dd className="font-bold tabular-nums">{money(paid)}</dd>
              </div>
              <div
                className={`rounded-lg p-3 ${owed > 0 ? "bg-red-50" : owed < 0 ? "bg-amber-50" : "bg-emerald-50"}`}
              >
                <dt className="text-xs text-navy/50">
                  {owed < 0 ? "Refund due" : owed > 0 ? "Balance pending" : "Balance"}
                </dt>
                <dd
                  className={`font-bold tabular-nums ${owed > 0 ? "text-red-700" : owed < 0 ? "text-amber-800" : "text-emerald-700"}`}
                >
                  {money(Math.abs(owed))}
                </dd>
              </div>
            </dl>
            {app.status === "cancelled" ? (
              <p className="text-sm text-navy/50">
                Cancelled — no further payments.
              </p>
            ) : !ready ? (
              <p className="text-sm text-navy/50">
                Save a quote with a company and a price before taking payment.
              </p>
            ) : owed > 0 && can.recordPayment(staff.role) ? (
              <PaymentForm
                key={owed}
                id={app.id}
                owed={owed}
                today={dubaiDate()}
              />
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
                {issuer.trade_name} has no TRN, so its documents are plain
                invoices with no VAT line.
              </p>
            )}
          </Card>


          <Card
            title="Client"
            action={
              client && (
                <TableLink href={`/clients/${client.id}`}>
                  {can.editClient(staff.role) ? "Edit" : "Open"}
                </TableLink>
              )
            }
          >
            {client ? (
              <dl className="divide-y divide-navy/5">
                <Row label="Name">{client.full_name}</Row>
                <Row label="Nationality">{client.nationality}</Row>
                <Row label="Phone">{client.phone ?? "—"}</Row>
                <Row label="Email">{client.email ?? "—"}</Row>
              </dl>
            ) : (
              <Notice tone="error">Client record missing.</Notice>
            )}
          </Card>

          <Card title="Sale details">
            {can.editSale(staff.role) ? (
              <DetailsForm
                id={app.id}
                isAdmin={isAdmin}
                countries={countries}
                consultants={
                  can.assignConsultant(staff.role)
                    ? staffList.filter((s) => s.active && s.role !== "accounts")
                    : null
                }
                issuers={allIssuers.map((i) => ({
                  id: i.id,
                  trade_name: i.trade_name,
                  legal_name: i.legal_name,
                }))}
                initial={{
                  country_code: app.country_code,
                  visa_type: app.visa_type,
                  source: app.source,
                  consultant: app.consultant,
                  notes: app.notes,
                  lead_status: app.lead_status,
                  issued_by: app.issued_by,
                  invoice_number: app.invoice_number,
                  invoice_date: app.invoice_date,
                  quotation_number: app.quotation_number,
                  quotation_date: app.quotation_date,
                }}
              />
            ) : (
              <>
                <dl className="divide-y divide-navy/5">
                  <Row label="Destination">
                    {country?.name ?? app.country_code}
                  </Row>
                  <Row label="Visa type">
                    {app.visa_type ? VISA_TYPE_LABEL[app.visa_type] : "—"}
                  </Row>
                  <Row label="Source">
                    {app.source ? SOURCE_LABEL[app.source] : "—"}
                  </Row>
                  <Row label="Consultant">
                    {nameOf(staffList, app.consultant)}
                  </Row>
                  <Row label="Created">{formatDate(app.created_at)}</Row>
                  {app.submitted_at && (
                    <Row label="Submitted">{formatDate(app.submitted_at)}</Row>
                  )}
                  {app.decided_at && (
                    <Row label="Decided">{formatDate(app.decided_at)}</Row>
                  )}
                </dl>
                {app.notes && (
                  <p className="mt-3 whitespace-pre-line text-sm text-navy/70">
                    {app.notes}
                  </p>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
