"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { FileCheck2, FileText } from "lucide-react";
import { METHOD_LABEL } from "@/lib/format";
import { money } from "@/lib/vat";
import {
  Field,
  Notice,
  buttonClass,
  darkButtonClass,
  inputClass,
  secondaryButtonClass,
} from "@/components/ui";
import {
  convertToInvoice,
  issueQuotation,
  recordPayment,
  type ActionResult,
} from "./actions";

function useAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult>(null);
  const run = (fn: () => Promise<ActionResult>) => start(async () => setResult(await fn()));
  return { pending, result, run };
}

function Result({ result }: { result: ActionResult }) {
  if (result?.error) return <Notice tone="error">{result.error}</Notice>;
  if (result?.ok) return <Notice tone="ok">{result.ok}</Notice>;
  return null;
}

export function DocumentButtons({
  id,
  quotationNumber,
  invoiceNumber,
  canIssue,
  ready,
}: {
  id: string;
  quotationNumber: string | null;
  invoiceNumber: string | null;
  canIssue: boolean;
  /** A company and a price are saved. */
  ready: boolean;
}) {
  const { pending, result, run } = useAction();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {quotationNumber ? (
          <Link href={`/documents/${id}?type=quotation`} className={secondaryButtonClass}>
            <FileText className="h-4 w-4" />
            Quotation {quotationNumber}
          </Link>
        ) : (
          canIssue &&
          !invoiceNumber && (
            <button
              type="button"
              disabled={pending || !ready}
              onClick={() => run(() => issueQuotation(id))}
              className={secondaryButtonClass}
            >
              <FileText className="h-4 w-4" />
              Issue quotation
            </button>
          )
        )}

        {invoiceNumber ? (
          <Link href={`/documents/${id}?type=invoice`} className={darkButtonClass}>
            <FileCheck2 className="h-4 w-4" />
            Invoice {invoiceNumber}
          </Link>
        ) : (
          canIssue && (
            <button
              type="button"
              disabled={pending || !ready}
              onClick={() => {
                if (
                  confirm(
                    "Issue the invoice? It gets the next invoice number for this company, and its figures can't be changed afterwards."
                  )
                ) {
                  run(() => convertToInvoice(id));
                }
              }}
              className={buttonClass}
            >
              <FileCheck2 className="h-4 w-4" />
              {quotationNumber ? "Convert to invoice" : "Issue invoice"}
            </button>
          )
        )}
      </div>
      {!ready && canIssue && !invoiceNumber && (
        <p className="text-xs text-navy/50">Save a quote with a company and a price to issue documents.</p>
      )}
      <Result result={result} />
    </div>
  );
}

function PaySubmit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass}>
      {pending ? "Saving…" : "Record payment"}
    </button>
  );
}

export function PaymentForm({ id, owed, today }: { id: string; owed: number; today: string }) {
  const [state, action] = useFormState(recordPayment, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Amount (AED)" hint={`Balance ${money(owed)}`}>
          <input
            name="amount"
            type="number"
            min="0.01"
            max={owed}
            step="0.01"
            required
            defaultValue={owed}
            className={inputClass}
          />
        </Field>
        <Field label="Method">
          <select name="method" required defaultValue="card" className={inputClass}>
            {Object.entries(METHOD_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input name="paid_at" type="date" max={today} defaultValue={today} className={inputClass} />
        </Field>
        <Field label="Reference" hint="Card slip, transfer ref, cheque no.">
          <input name="reference" className={inputClass} />
        </Field>
        <Field label="Note" className="sm:col-span-2">
          <input name="note" className={inputClass} />
        </Field>
      </div>
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      {state?.ok && <Notice tone="ok">{state.ok}</Notice>}
      <PaySubmit />
    </form>
  );
}
