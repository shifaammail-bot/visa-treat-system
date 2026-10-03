"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Pencil, Trash2 } from "lucide-react";
import {
  CHANNEL_LABEL,
  LEAD_STATUS_LABEL,
  METHOD_LABEL,
  SOURCE_LABEL,
  VISA_TYPE_LABEL,
} from "@/lib/format";
import type {
  Country,
  LeadStatus,
  Payment,
  Source,
  VisaType,
} from "@/lib/types";
import { money } from "@/lib/vat";
import {
  Field,
  Notice,
  buttonClass,
  inputClass,
  secondaryButtonClass,
} from "@/components/ui";
import {
  deletePayment,
  saveDetails,
  updatePayment,
  type ActionResult,
} from "./actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass}>
      {pending ? "Saving…" : label}
    </button>
  );
}

function Result({ state }: { state: ActionResult }) {
  if (state?.error) return <Notice tone="error">{state.error}</Notice>;
  if (state?.ok) return <Notice tone="ok">{state.ok}</Notice>;
  return null;
}

type DetailsProps = {
  id: string;
  isAdmin: boolean;
  countries: Country[];
  consultants: { email: string; full_name: string }[] | null;
  issuers: { id: string; trade_name: string; legal_name: string }[];
  initial: {
    country_code: string;
    visa_type: VisaType | null;
    source: Source | null;
    consultant: string;
    notes: string | null;
    lead_status: LeadStatus;
    issued_by: string | null;
    invoice_number: string | null;
    invoice_date: string;
    quotation_number: string | null;
    quotation_date: string | null;
  };
};

/**
 * Destination, visa type, channel, consultant and notes for anyone who sells;
 * admins also get lead status, company, and document numbers and dates.
 */
export function DetailsForm({
  id,
  isAdmin,
  countries,
  consultants,
  issuers,
  initial,
}: DetailsProps) {
  const [state, action] = useFormState(saveDetails, null);
  const v = initial;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Destination">
          <select
            name="country_code"
            defaultValue={v.country_code}
            className={inputClass}
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Visa type">
          <select
            name="visa_type"
            defaultValue={v.visa_type ?? "tourist"}
            className={inputClass}
          >
            {Object.entries(VISA_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Channel">
          <select
            name="source"
            defaultValue={v.source ?? "other"}
            className={inputClass}
          >
            {v.source === "direct" && (
              <option value="direct">{SOURCE_LABEL.direct}</option>
            )}
            {Object.entries(CHANNEL_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        {consultants && (
          <Field label="Consultant">
            <select
              name="consultant"
              defaultValue={v.consultant}
              className={inputClass}
            >
              {!consultants.some(
                (c) => c.email.toLowerCase() === v.consultant.toLowerCase(),
              ) && <option value={v.consultant}>{v.consultant}</option>}
              {consultants.map((c) => (
                <option key={c.email} value={c.email}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      {isAdmin && (
        <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/40 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
            Admin corrections
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lead status">
              <select
                name="lead_status"
                defaultValue={v.lead_status}
                className={inputClass}
              >
                {Object.entries(LEAD_STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Issuing company">
              <select
                name="issued_by"
                defaultValue={v.issued_by ?? ""}
                className={inputClass}
              >
                <option value="">Not chosen</option>
                {issuers.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.trade_name} — {i.legal_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Invoice number"
              hint={
                v.invoice_number
                  ? undefined
                  : "Blank until the invoice is issued."
              }
            >
              <input
                name="invoice_number"
                defaultValue={v.invoice_number ?? ""}
                className={inputClass}
              />
            </Field>
            <Field label="Invoice date">
              <input
                name="invoice_date"
                type="date"
                defaultValue={v.invoice_date}
                className={inputClass}
              />
            </Field>
            <Field label="Quotation number">
              <input
                name="quotation_number"
                defaultValue={v.quotation_number ?? ""}
                className={inputClass}
              />
            </Field>
            <Field label="Quotation date">
              <input
                name="quotation_date"
                type="date"
                defaultValue={v.quotation_date ?? ""}
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      )}

      <Field label="Internal notes" hint="Not printed.">
        <textarea
          name="notes"
          rows={2}
          defaultValue={v.notes ?? ""}
          className={inputClass}
        />
      </Field>
      <Result state={state} />
      <Submit label="Save details" />
    </form>
  );
}

/** One payment, with Edit and Remove for admins. */
export function PaymentEditor({
  id,
  payment,
}: {
  id: string;
  payment: Payment;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(updatePayment, null);
  const [pending, start] = useTransition();
  const [removeResult, setRemoveResult] = useState<ActionResult>(null);

  return (
    <div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-navy/60 hover:bg-navy/5 hover:text-navy"
        >
          <Pencil className="h-3.5 w-3.5" />
          {open ? "Close" : "Edit"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              !confirm(
                `Remove the payment of ${money(payment.amount)}? This can't be undone.`,
              )
            )
              return;
            start(async () =>
              setRemoveResult(await deletePayment(id, payment.id)),
            );
          }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove
        </button>
      </div>
      {removeResult?.error && (
        <Notice tone="error">{removeResult.error}</Notice>
      )}
      {open && (
        <form action={action} className="mt-3 basis-full space-y-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="payment_id" value={payment.id} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Amount (AED)">
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                defaultValue={payment.amount}
                className={inputClass}
              />
            </Field>
            <Field label="Method">
              <select
                name="method"
                defaultValue={payment.method}
                className={inputClass}
              >
                {Object.entries(METHOD_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input
                name="paid_at"
                type="date"
                required
                defaultValue={payment.paid_at}
                className={inputClass}
              />
            </Field>
            <Field label="Reference">
              <input
                name="reference"
                defaultValue={payment.reference ?? ""}
                className={inputClass}
              />
            </Field>
            <Field label="Note" className="sm:col-span-2">
              <input
                name="note"
                defaultValue={payment.note ?? ""}
                className={inputClass}
              />
            </Field>
          </div>
          <Result state={state} />
          <div className="flex gap-2">
            <Submit label="Save payment" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
