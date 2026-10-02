"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { Role } from "@/lib/auth";
import { Field, Notice, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { createStaff, resetPassword, updateStaff, type FormResult } from "./actions";

type IssuerOption = { id: string; trade_name: string };

export type StaffRow = {
  email: string;
  full_name: string;
  role: Role;
  issuer_ids: string[] | null;
  monthly_target: number | null;
  active: boolean;
};

const ROLE_OPTIONS: { value: Role; label: string; hint: string }[] = [
  { value: "consultant", label: "Consultant", hint: "Own leads and applications only. No costs." },
  { value: "manager", label: "Manager", hint: "Everything for their brands." },
  { value: "accounts", label: "Accounts", hint: "All invoices and payments. Can't edit clients." },
  { value: "admin", label: "Admin", hint: "Everything, including staff." },
];

function Submit({ children, className = buttonClass }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Saving…" : children}
    </button>
  );
}

function Result({ state }: { state: FormResult }) {
  if (!state) return null;
  if (state.error) return <Notice tone="error">{state.error}</Notice>;
  if (state.ok) return <Notice tone="ok">{state.ok}</Notice>;
  return null;
}

function BrandPicker({ issuers, selected }: { issuers: IssuerOption[]; selected: string[] | null }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">Brands they manage</legend>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {issuers.map((issuer) => (
          <label key={issuer.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="issuer_ids"
              value={issuer.id}
              defaultChecked={!selected || selected.includes(issuer.id)}
              className="accent-mint-600"
            />
            {issuer.trade_name}
          </label>
        ))}
      </div>
      <p className="mt-1 text-xs text-navy/50">All ticked means every brand, including future ones.</p>
    </fieldset>
  );
}

export function CreateStaffForm({ issuers }: { issuers: IssuerOption[] }) {
  const [state, action] = useFormState(createStaff, null);
  const [role, setRole] = useState<Role>("consultant");

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <input name="full_name" required className={inputClass} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" required className={inputClass} />
        </Field>
        <Field label="Role" hint={ROLE_OPTIONS.find((r) => r.value === role)?.hint}>
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className={inputClass}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Temporary password" hint="At least 8 characters. Give it to them in person.">
          <input name="password" type="text" minLength={8} required autoComplete="off" className={inputClass} />
        </Field>
        <Field label="Monthly target (AED)" hint="Optional. Shown on the reports.">
          <input name="monthly_target" type="number" min="0" step="0.01" className={inputClass} />
        </Field>
      </div>
      {role === "manager" && <BrandPicker issuers={issuers} selected={null} />}
      <Result state={state} />
      <Submit>Create login</Submit>
    </form>
  );
}

export function EditStaffForm({
  row,
  issuers,
  isMe,
}: {
  row: StaffRow;
  issuers: IssuerOption[];
  isMe: boolean;
}) {
  const [state, action] = useFormState(updateStaff, null);
  const [pwState, pwAction] = useFormState(resetPassword, null);
  const [role, setRole] = useState<Role>(row.role);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="email" value={row.email} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Full name">
            <input name="full_name" defaultValue={row.full_name} required className={inputClass} />
          </Field>
          <Field label="Role">
            <select
              name="role"
              value={role}
              disabled={isMe}
              onChange={(e) => setRole(e.target.value as Role)}
              className={inputClass}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {isMe && <input type="hidden" name="role" value={row.role} />}
          </Field>
          <Field label="Monthly target (AED)">
            <input
              name="monthly_target"
              type="number"
              min="0"
              step="0.01"
              defaultValue={row.monthly_target ?? ""}
              className={inputClass}
            />
          </Field>
        </div>
        {role === "manager" && <BrandPicker issuers={issuers} selected={row.issuer_ids} />}
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            name="active"
            defaultChecked={row.active}
            disabled={isMe}
            className="accent-mint-600"
          />
          Active (can sign in)
          {isMe && <input type="hidden" name="active" value="on" />}
        </label>
        <Result state={state} />
        <Submit>Save changes</Submit>
      </form>

      <form action={pwAction} className="flex flex-wrap items-end gap-3 border-t border-navy/10 pt-4">
        <input type="hidden" name="email" value={row.email} />
        <Field label="New password" className="min-w-[220px] flex-1">
          <input name="password" type="text" minLength={8} required autoComplete="off" className={inputClass} />
        </Field>
        <Submit className={secondaryButtonClass}>Set password</Submit>
        <div className="basis-full">
          <Result state={pwState} />
        </div>
      </form>
    </div>
  );
}
