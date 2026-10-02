"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { FileCheck2, FileText } from "lucide-react";
import { METHOD_LABEL, VISA_TYPE_LABEL } from "@/lib/format";
import type { Country, VisaProduct } from "@/lib/types";
import { QuoteFields, type IssuerOption } from "@/components/QuoteFields";
import { Card, Field, Notice, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { createSale } from "./actions";

type Props = {
  kind: "invoice" | "quotation";
  countries: Country[];
  issuers: IssuerOption[];
  products: VisaProduct[];
  showCosts: boolean;
  consultants: { email: string; full_name: string }[] | null;
  me: string;
  existingClient: { id: string; full_name: string; nationality: string; phone: string | null } | null;
  defaultTerms: string;
};

function SubmitButtons({ kind }: { kind: Props["kind"] }) {
  const { pending } = useFormStatus();
  const primary = (
    <button type="submit" name="kind" value={kind} disabled={pending} className={buttonClass}>
      {kind === "invoice" ? <FileCheck2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
      {pending ? "Issuing…" : kind === "invoice" ? "Issue invoice" : "Issue quotation"}
    </button>
  );
  const other = kind === "invoice" ? "quotation" : "invoice";
  return (
    <div className="flex flex-wrap items-center gap-3">
      {primary}
      <button type="submit" name="kind" value={other} disabled={pending} className={secondaryButtonClass}>
        {other === "invoice" ? "Issue as invoice instead" : "Issue as quotation instead"}
      </button>
    </div>
  );
}

export function SaleForm(props: Props) {
  const { kind, countries, issuers, products, showCosts, consultants, me, existingClient, defaultTerms } = props;
  const [state, action] = useFormState(createSale, null);
  const [country, setCountry] = useState("");
  const [fromProduct, setFromProduct] = useState(false);

  return (
    <form action={action} className="space-y-6">
      <Card title="Client">
        {existingClient ? (
          <>
            <input type="hidden" name="client_id" value={existingClient.id} />
            <p className="font-bold">{existingClient.full_name}</p>
            <p className="text-sm text-navy/60">
              {existingClient.nationality}
              {existingClient.phone ? ` · ${existingClient.phone}` : ""}
            </p>
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <input name="full_name" required className={inputClass} />
            </Field>
            <Field label="Nationality">
              <input name="nationality" required className={inputClass} placeholder="e.g. Indian" />
            </Field>
            <Field label="Phone">
              <input name="phone" type="tel" className={inputClass} placeholder="+971…" />
            </Field>
            <Field label="Email">
              <input name="email" type="email" className={inputClass} />
            </Field>
            <Field label="Client's own reference" hint="Optional. Printed on the document.">
              <input name="client_ref" className={inputClass} />
            </Field>
          </div>
        )}
      </Card>

      <Card title="Trip">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Destination" hint={fromProduct ? "Set by the visa product below." : undefined}>
            <select
              name="country_code"
              required
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setFromProduct(false);
              }}
              className={inputClass}
            >
              <option value="" disabled>
                Choose…
              </option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Visa type">
            <select name="visa_type" defaultValue="tourist" className={inputClass}>
              {Object.entries(VISA_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          {consultants && (
            <Field label="Consultant">
              <select name="consultant" defaultValue={me} className={inputClass}>
                {consultants.map((c) => (
                  <option key={c.email} value={c.email}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      </Card>

      <Card title="Price">
        <QuoteFields
          countryCode={country}
          issuers={issuers}
          products={products}
          showCosts={showCosts}
          onProductCountry={(code) => {
            setCountry(code);
            setFromProduct(true);
          }}
          initial={{
            issued_by: null,
            product_id: null,
            product_name: "",
            quantity: 1,
            service_charge: 0,
            selling_price: 0,
            cost_price: showCosts ? 0 : null,
            terms: defaultTerms,
          }}
        />
      </Card>

      {kind === "invoice" && (
        <Card title="Payment received now">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Amount (AED)" hint="Leave blank if nothing was paid yet.">
              <input name="paid_amount" type="number" min="0" step="0.01" className={inputClass} />
            </Field>
            <Field label="Method">
              <select name="paid_method" defaultValue="card" className={inputClass}>
                {Object.entries(METHOD_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reference" hint="Card slip, transfer ref…">
              <input name="paid_reference" className={inputClass} />
            </Field>
          </div>
        </Card>
      )}

      <Field label="Internal notes" hint="Not printed.">
        <textarea name="notes" rows={2} className={inputClass} />
      </Field>

      {state?.error && (
        <Notice tone="error">
          {state.error}
          {state.applicationId && (
            <>
              {" "}
              <Link href={`/applications/${state.applicationId}`} className="font-bold underline">
                Open the sale
              </Link>
            </>
          )}
        </Notice>
      )}
      <SubmitButtons kind={kind} />
    </form>
  );
}
