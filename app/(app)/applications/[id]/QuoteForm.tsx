"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { margin, money, vatSplit } from "@/lib/vat";
import type { VisaProduct } from "@/lib/types";
import { Field, Notice, buttonClass, inputClass } from "@/components/ui";
import { saveQuote } from "./actions";

type IssuerOption = {
  id: string;
  trade_name: string;
  legal_name: string;
  /** vat_registered && trn is not null — the only test that counts. */
  taxInvoice: boolean;
};

type Props = {
  applicationId: string;
  countryCode: string;
  issuers: IssuerOption[];
  products: VisaProduct[];
  showCosts: boolean;
  initial: {
    issued_by: string | null;
    product_id: string | null;
    product_name: string;
    quantity: number;
    government_fee: number;
    service_charge: number;
    selling_price: number;
    cost_price: number | null;
    terms: string;
  };
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass}>
      {pending ? "Saving…" : "Save quote"}
    </button>
  );
}

const str = (n: number) => (n ? String(n) : "");

export function QuoteForm({ applicationId, countryCode, issuers, products, showCosts, initial }: Props) {
  const [state, action] = useFormState(saveQuote, null);

  const [issuerId, setIssuerId] = useState(initial.issued_by ?? (issuers.length === 1 ? issuers[0].id : ""));
  const [productId, setProductId] = useState(initial.product_id ?? "");
  const [productName, setProductName] = useState(initial.product_name);
  const [quantity, setQuantity] = useState(String(initial.quantity || 1));
  const [govFee, setGovFee] = useState(str(initial.government_fee));
  const [service, setService] = useState(str(initial.service_charge));
  const [selling, setSelling] = useState(str(initial.selling_price));
  const [cost, setCost] = useState(str(initial.cost_price ?? 0));
  const [terms, setTerms] = useState(initial.terms);

  const issuer = issuers.find((i) => i.id === issuerId);
  const product = products.find((p) => p.id === productId);
  const here = products.filter((p) => p.country_code === countryCode);
  const elsewhere = products.filter((p) => p.country_code !== countryCode);

  const pickProduct = (id: string) => {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setProductName(p.name);
    setGovFee(str(p.government_fee));
    setService(str(p.default_service_charge));
    setSelling(str(p.default_selling_price || p.government_fee + p.default_service_charge));
    if (p.terms) setTerms(p.terms);
    if (!issuerId && p.default_issuer_id && issuers.some((i) => i.id === p.default_issuer_id)) {
      setIssuerId(p.default_issuer_id);
    }
  };

  const split = useMemo(
    () => vatSplit(Number(selling) || 0, Number(service) || 0, Number(quantity) || 1, issuer?.taxInvoice ?? false),
    [selling, service, quantity, issuer]
  );
  const people = Math.max(1, Math.floor(Number(quantity) || 1));
  const tooLow = Number(selling) > 0 && Number(selling) + 0.001 < (Number(govFee) || 0) + (Number(service) || 0);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={applicationId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Issuing company">
          <select
            name="issued_by"
            required
            value={issuerId}
            onChange={(e) => setIssuerId(e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Choose…
            </option>
            {issuers.map((i) => (
              <option key={i.id} value={i.id}>
                {i.trade_name} — {i.legal_name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Visa product">
          <select
            name="product_id"
            value={productId}
            onChange={(e) => (e.target.value ? pickProduct(e.target.value) : setProductId(""))}
            className={inputClass}
          >
            <option value="">Manual entry</option>
            {here.length > 0 && (
              <optgroup label="This destination">
                {here.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.placeholder ? " (placeholder rate)" : ""}
                  </option>
                ))}
              </optgroup>
            )}
            {elsewhere.length > 0 && (
              <optgroup label="Other destinations">
                {elsewhere.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.placeholder ? " (placeholder rate)" : ""}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </Field>
      </div>

      {product?.placeholder && (
        <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Placeholder rate.</strong> These fees are not the real price list yet. Check the government
            fee and charge before sending this quote.
          </p>
        </div>
      )}

      <Field label="Visa description" hint="Printed on the quotation and invoice.">
        <input
          name="product_name"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          readOnly={!!product}
          required
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="People">
          <input
            name="quantity"
            type="number"
            min="1"
            max="99"
            step="1"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Government fee" hint="Per person. No VAT.">
          <input
            name="government_fee"
            type="number"
            min="0"
            step="0.01"
            value={govFee}
            onChange={(e) => setGovFee(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Service charge" hint="Per person, VAT-inclusive.">
          <input
            name="service_charge"
            type="number"
            min="0"
            step="0.01"
            value={service}
            onChange={(e) => setService(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Selling price" hint="Per person. What the client pays.">
          <input
            name="selling_price"
            type="number"
            min="0"
            step="0.01"
            required
            value={selling}
            onChange={(e) => setSelling(e.target.value)}
            className={inputClass}
          />
        </Field>
        {showCosts && (
          <Field label="Cost price" hint="Per person. Admin and managers only.">
            <input
              name="cost_price"
              type="number"
              min="0"
              step="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              className={inputClass}
            />
          </Field>
        )}
      </div>

      {tooLow && (
        <Notice tone="warn">
          The selling price is less than the government fee plus the service charge. The service charge sits
          inside the price, so the price has to cover both.
        </Notice>
      )}

      <div className="rounded-xl bg-navy/[0.03] p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-navy/50">
          {issuer ? (issuer.taxInvoice ? "Tax invoice preview" : "Invoice preview — no VAT") : "Preview"}
        </p>
        <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          <div className="flex justify-between">
            <dt className="text-navy/60">Government fees ({people} × {money(Number(govFee) || 0)})</dt>
            <dd className="tabular-nums">{money((Number(govFee) || 0) * people)}</dd>
          </div>
          {split.taxable_supply ? (
            <>
              <div className="flex justify-between">
                <dt className="text-navy/60">Service charge excl. VAT</dt>
                <dd className="tabular-nums">{money(split.taxable)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-navy/60">VAT 5% (inside the service charge)</dt>
                <dd className="tabular-nums">{money(split.vat)}</dd>
              </div>
            </>
          ) : (
            <div className="flex justify-between">
              <dt className="text-navy/60">VAT</dt>
              <dd className="text-navy/60">{issuer ? "None — company has no TRN" : "Choose a company"}</dd>
            </div>
          )}
          {showCosts && (
            <div className="flex justify-between">
              <dt className="text-navy/60">Margin</dt>
              <dd className="tabular-nums">
                {money(margin(Number(selling) || 0, Number(cost) || 0, Number(govFee) || 0, people))}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-t border-navy/10 pt-1.5 font-bold sm:col-span-2">
            <dt>Client pays</dt>
            <dd className="tabular-nums">{money(split.grandTotal)}</dd>
          </div>
        </dl>
      </div>

      <Field label="Terms and conditions" hint="Printed on the quotation and invoice.">
        <textarea
          name="terms"
          rows={5}
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          className={`${inputClass} text-xs`}
        />
      </Field>

      {state?.error && <Notice tone="error">{state.error}</Notice>}
      {state?.ok && <Notice tone="ok">{state.ok}</Notice>}
      <Submit />
    </form>
  );
}
