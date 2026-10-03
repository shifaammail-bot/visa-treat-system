"use client";

import { useFormState, useFormStatus } from "react-dom";
import { CHANNEL_LABEL, VISA_TYPE_LABEL } from "@/lib/format";
import type { Country } from "@/lib/types";
import { Card, Field, Notice, buttonClass, inputClass } from "@/components/ui";
import { createLead } from "./actions";

type Props = {
  countries: Country[];
  brands: { id: string; trade_name: string }[];
  consultants: { email: string; full_name: string }[] | null;
  me: string;
  existingClient: { id: string; full_name: string; nationality: string; phone: string | null } | null;
  tomorrow: string;
  today: string;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass}>
      {pending ? "Saving…" : "Save lead"}
    </button>
  );
}

export function LeadForm({ countries, brands, consultants, me, existingClient, tomorrow, today }: Props) {
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
            <Field label="Full name">
              <input name="full_name" required className={inputClass} />
            </Field>
            <Field label="Phone / WhatsApp">
              <input name="phone" type="tel" className={inputClass} placeholder="+971…" />
            </Field>
            <Field label="Email">
              <input name="email" type="email" className={inputClass} />
            </Field>
            <Field label="Nationality">
              <input name="nationality" required className={inputClass} placeholder="e.g. Indian" />
            </Field>
          </div>
        )}
      </Card>

      <Card title="How they found us">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Brand" hint="Which of our brands the enquiry came through.">
            <select name="issued_by" required defaultValue={brands.length === 1 ? brands[0].id : ""} className={inputClass}>
              <option value="" disabled>
                Choose…
              </option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.trade_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Channel">
            <select name="source" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Choose…
              </option>
              {Object.entries(CHANNEL_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Referred by / campaign" hint="Optional. Who referred them, or which ad or post." className="sm:col-span-2">
            <input name="referral" className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card title="What they want">
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
          <Field label="What was discussed" hint="Their question, what you told them, prices mentioned." className="sm:col-span-2">
            <textarea name="notes" rows={3} className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card title="Follow-up">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Next follow-up" hint="When to contact them again.">
            <input name="next_follow_up" type="date" min={today} defaultValue={tomorrow} required className={inputClass} />
          </Field>
          {consultants ? (
            <Field label="Handled by">
              <select name="consultant" defaultValue={me} className={inputClass}>
                {consultants.map((c) => (
                  <option key={c.email} value={c.email}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Handled by" hint="Leads you create are assigned to you.">
              <input value="You" disabled className={inputClass} />
            </Field>
          )}
        </div>
      </Card>

      {state?.error && <Notice tone="error">{state.error}</Notice>}
      <Submit />
    </form>
  );
}
