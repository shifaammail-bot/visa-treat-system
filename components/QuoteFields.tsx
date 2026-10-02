"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { margin, money, vatSplit } from "@/lib/vat";
import type { VisaProduct } from "@/lib/types";
import { Field, Notice, inputClass } from "@/components/ui";

export type IssuerOption = {
  id: string;
  trade_name: string;
  legal_name: string;
  /** vat_registered && trn is not null — the only test that counts. */
  taxInvoice: boolean;
};

export type QuoteInitial = {
  issued_by: string | null;
  product_id: string | null;
  product_name: string;
  quantity: number;
  service_charge: number;
  selling_price: number;
  cost_price: number | null;
  terms: string;
};

type Props = {
  /** Destination, for grouping products. */
  countryCode: string;
  issuers: IssuerOption[];
  products: VisaProduct[];
  showCosts: boolean;
  initial: QuoteInitial;
  /** Told when a catalogue product is picked, so a parent can follow its destination. */
  onProductCountry?: (code: string) => void;
  /** An issued invoice keeps its company: show it, but don't allow a change. */
  lockIssuer?: boolean;
};

const str = (n: number) => (n ? String(n) : "");

/**
 * Company, visa, guests, selling price, service fee, cost and terms, with a
 * live VAT preview from lib/vat.ts. No <form> of its own: used inside the quote form and the
 * direct-sale form.
 */
export function QuoteFields({
  countryCode,
  issuers,
  products,
  showCosts,
  initial,
  onProductCountry,
  lockIssuer,
}: Props) {
  const [issuerId, setIssuerId] = useState(
    initial.issued_by ?? (issuers.length === 1 ? issuers[0].id : ""),
  );
  const [productId, setProductId] = useState(initial.product_id ?? "");
  const [productName, setProductName] = useState(initial.product_name);
  const [quantity, setQuantity] = useState(String(initial.quantity || 1));
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
    onProductCountry?.(p.country_code);
    setProductName(p.name);
    setService(str(p.default_service_charge));
    setSelling(str(p.default_selling_price));
    if (p.terms) setTerms(p.terms);
    if (
      !issuerId &&
      p.default_issuer_id &&
      issuers.some((i) => i.id === p.default_issuer_id)
    ) {
      setIssuerId(p.default_issuer_id);
    }
  };

  const split = useMemo(
    () =>
      vatSplit(
        Number(selling) || 0,
        Number(service) || 0,
        Number(quantity) || 1,
        issuer?.taxInvoice ?? false,
      ),
    [selling, service, quantity, issuer],
  );
  const guests = Math.max(1, Math.floor(Number(quantity) || 1));
  const tooLow =
    Number(selling) > 0 && Number(selling) + 0.001 < (Number(service) || 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Issuing company"
          hint={lockIssuer ? "Fixed once the invoice is issued." : undefined}
        >
          {lockIssuer && (
            <input type="hidden" name="issued_by" value={issuerId} />
          )}
          <select
            name={lockIssuer ? undefined : "issued_by"}
            required
            disabled={lockIssuer}
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
            onChange={(e) =>
              e.target.value ? pickProduct(e.target.value) : setProductId("")
            }
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
            <strong>Placeholder rate.</strong> These prices are not the real
            price list yet. Check them before sending this quote.
          </p>
        </div>
      )}

      <Field
        label="Visa description"
        hint="Printed on the quotation and invoice."
      >
        <input
          name="product_name"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          required
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Guests">
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
        <Field label="Selling price" hint="Per guest. What the client pays.">
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
        <Field
          label="Service fee"
          hint="Per guest, inside the selling price. VAT is taken from this."
        >
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
        {showCosts && (
          <Field
            label="Cost"
            hint="Per guest. What we pay out. Admin and managers only."
          >
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
          The service fee is more than the selling price. The service fee is
          part of the price, so it can&apos;t be bigger than it.
        </Notice>
      )}

      <div className="rounded-xl bg-navy/[0.03] p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-navy/50">
          {issuer
            ? issuer.taxInvoice
              ? "Tax invoice preview"
              : "Invoice preview — no VAT"
            : "Preview"}
        </p>
        <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          <div className="flex justify-between">
            <dt className="text-navy/60">
              {guests} guest{guests === 1 ? "" : "s"} ×{" "}
              {money(Number(selling) || 0)}
            </dt>
            <dd className="tabular-nums">{money(split.grandTotal)}</dd>
          </div>
          {split.taxable_supply ? (
            <div className="flex justify-between">
              <dt className="text-navy/60">VAT 5% inside the service fee</dt>
              <dd className="tabular-nums">{money(split.vat)}</dd>
            </div>
          ) : (
            <div className="flex justify-between">
              <dt className="text-navy/60">VAT</dt>
              <dd className="text-navy/60">
                {issuer ? "None — company has no TRN" : "Choose a company"}
              </dd>
            </div>
          )}
          {showCosts && (
            <div className="flex justify-between">
              <dt className="text-navy/60">Profit</dt>
              <dd className="tabular-nums">
                {money(
                  margin(Number(selling) || 0, Number(cost) || 0, 0, guests),
                )}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-t border-navy/10 pt-1.5 font-bold sm:col-span-2">
            <dt>Client pays</dt>
            <dd className="tabular-nums">{money(split.grandTotal)}</dd>
          </div>
        </dl>
      </div>

      <Field
        label="Terms and conditions"
        hint="Printed on the quotation and invoice."
      >
        <textarea
          name="terms"
          rows={5}
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          className={`${inputClass} text-xs`}
        />
      </Field>
    </div>
  );
}
