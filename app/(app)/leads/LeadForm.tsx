"use client";

import { useFormState, useFormStatus } from "react-dom";
import { SOURCE_LABEL, VISA_TYPE_LABEL } from "@/lib/format";
import type { Country } from "@/lib/types";
import { Card, Field, Notice, buttonClass, inputClass } from "@/components/ui";
import { createLead } from "./actions";

type Props = {
  countries: Country[];
  consultants: { email: string; full_name: string }[] | null;
  me: string;
  existingClient: { id: string; full_name: string; nationality: string; phone: string | null } | null;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass}>
      {pending ? "Saving…" : "Save lead"}
    </button>
  );
}

export function LeadForm({ countries, consultants, me, existingClient }: Props) {
  const [state, action] = useFormState(createLead, null);

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
            <Field label="Full name (as on passport)">
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
            <Field label="Passport number" hint="Optional at enquiry stage.">
              <input name="passport_no" className={`${inputClass} uppercase`} />
            </Field>
          </div>
        )}
      </Card>

      <Card title="Trip">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Destination">
            <select name="country_code" required defaultValue="" className={inputClass}>
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
            <select name="visa_type" required defaultValue="tourist" className={inputClass}>
              {Object.entries(VISA_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Travel date">
            <input name="travel_from" type="date" className={inputClass} />
          </Field>
          <Field label="Return date">
            <input name="travel_to" type="date" className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card title="Lead">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source channel">
            <select name="source" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Choose…
              </option>
              {Object.entries(SOURCE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          {consultants ? (
            <Field label="Assigned consultant">
              <select name="consultant" defaultValue={me} className={inputClass}>
                {consultants.map((c) => (
                  <option key={c.email} value={c.email}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Assigned consultant" hint="Leads you create are assigned to you.">
              <input value="You" disabled className={inputClass} />
            </Field>
          )}
          <Field label="Notes" className="sm:col-span-2">
            <textarea name="notes" rows={3} className={inputClass} />
          </Field>
        </div>
      </Card>

      {state?.error && <Notice tone="error">{state.error}</Notice>}
      <Submit />
    </form>
  );
}
