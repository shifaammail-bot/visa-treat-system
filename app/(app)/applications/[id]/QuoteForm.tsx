"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { VisaProduct } from "@/lib/types";
import {
  QuoteFields,
  type IssuerOption,
  type QuoteInitial,
} from "@/components/QuoteFields";
import { Notice, buttonClass } from "@/components/ui";
import { saveQuote } from "./actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass}>
      {pending ? "Saving…" : label}
    </button>
  );
}

export function QuoteForm({
  applicationId,
  invoiceNumber,
  ...fields
}: {
  applicationId: string;
  /** Set when an admin is correcting an issued invoice. */
  invoiceNumber?: string | null;
  countryCode: string;
  issuers: IssuerOption[];
  products: VisaProduct[];
  showCosts: boolean;
  initial: QuoteInitial;
}) {
  const [state, action] = useFormState(saveQuote, null);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={applicationId} />
      <QuoteFields {...fields} lockIssuer={!!invoiceNumber} />
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      {state?.ok && <Notice tone="ok">{state.ok}</Notice>}
      <Submit
        label={
          invoiceNumber ? `Save changes to ${invoiceNumber}` : "Save quote"
        }
      />
    </form>
  );
}
