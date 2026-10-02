"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { Client } from "@/lib/types";
import { Field, Notice, buttonClass, inputClass } from "@/components/ui";
import { updateClient } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass}>
      {pending ? "Saving…" : "Save client"}
    </button>
  );
}

export function ClientForm({ client, readOnly }: { client: Client; readOnly: boolean }) {
  const [state, action] = useFormState(updateClient, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={client.id} />
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <input name="full_name" defaultValue={client.full_name} required className={inputClass} />
        </Field>
        <Field label="Nationality">
          <input name="nationality" defaultValue={client.nationality} required className={inputClass} />
        </Field>
        <Field label="Phone">
          <input name="phone" type="tel" defaultValue={client.phone ?? ""} className={inputClass} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" defaultValue={client.email ?? ""} className={inputClass} />
        </Field>
        <Field label="Client's own reference" hint="Printed on their documents.">
          <input name="client_ref" defaultValue={client.client_ref ?? ""} className={inputClass} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea name="notes" rows={3} defaultValue={client.notes ?? ""} className={inputClass} />
        </Field>
      </fieldset>
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      {state?.ok && <Notice tone="ok">{state.ok}</Notice>}
      {!readOnly && <Submit />}
    </form>
  );
}
