"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { FOLLOW_UP_METHOD_LABEL, LOST_REASONS, formatDate } from "@/lib/format";
import type { FollowUp, LeadStatus } from "@/lib/types";
import { Field, Notice, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { logFollowUp, reopenLead, type ActionResult } from "./actions";

type Props = {
  id: string;
  leadStatus: LeadStatus;
  nextFollowUp: string | null;
  lostReason: string | null;
  closedAt: string | null;
  createdAt: string;
  firstNote: string | null;
  followUps: (FollowUp & { by: string })[];
  canEdit: boolean;
  /** Reopening a lost lead is a correction: super admin only. */
  canReopen: boolean;
  today: string;
  inTwoDays: string;
};

function Submit({ lost }: { lost: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={lost ? secondaryButtonClass : buttonClass}>
      {pending ? "Saving…" : lost ? "Close as lost" : "Log follow-up"}
    </button>
  );
}

/** The lead's contact history and the form for the next contact. */
export function FollowUps(props: Props) {
  const { id, leadStatus, nextFollowUp, lostReason, closedAt, createdAt, firstNote, followUps, canEdit, canReopen, today, inTwoDays } =
    props;
  const [state, action] = useFormState(logFollowUp, null);
  const [outcome, setOutcome] = useState<"follow_up" | "lost">("follow_up");
  const [pending, start] = useTransition();
  const [reopen, setReopen] = useState<ActionResult>(null);

  const overdue = leadStatus === "open" && nextFollowUp !== null && nextFollowUp < today;
  const dueToday = leadStatus === "open" && nextFollowUp === today;

  return (
    <div className="space-y-5">
      {leadStatus === "open" && (
        <Notice tone={overdue ? "error" : dueToday ? "warn" : "info"}>
          {nextFollowUp
            ? overdue
              ? `Follow-up overdue — it was due ${formatDate(nextFollowUp)}.`
              : dueToday
                ? "Follow up today."
                : `Next follow-up: ${formatDate(nextFollowUp)}.`
            : "No follow-up date set."}{" "}
          When they go ahead, fill in the price below and issue the invoice — the lead is then marked won.
        </Notice>
      )}
      {leadStatus === "won" && <Notice tone="ok">Won{closedAt ? ` on ${formatDate(closedAt)}` : ""} — invoiced.</Notice>}
      {leadStatus === "lost" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-navy/10 bg-navy/[0.03] px-4 py-3 text-sm">
          <p>
            <strong>Lost</strong>
            {closedAt ? ` on ${formatDate(closedAt)}` : ""}
            {lostReason ? ` — ${lostReason}` : ""}.
          </p>
          {canReopen && (
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => setReopen(await reopenLead(id)))}
              className={secondaryButtonClass}
            >
              They came back — reopen
            </button>
          )}
        </div>
      )}
      {reopen?.error && <Notice tone="error">{reopen.error}</Notice>}

      {/* History */}
      <ol className="space-y-3 border-l-2 border-navy/10 pl-4">
        <li>
          <p className="text-xs font-bold text-navy/50">Enquiry · {formatDate(createdAt)}</p>
          <p className="whitespace-pre-line text-sm">{firstNote || "First contact."}</p>
        </li>
        {followUps.map((f, i) => (
          <li key={f.id}>
            <p className="text-xs font-bold text-navy/50">
              Follow-up {i + 1} · {FOLLOW_UP_METHOD_LABEL[f.method]} · {formatDate(f.created_at)} · {f.by}
            </p>
            <p className="whitespace-pre-line text-sm">{f.note}</p>
            {f.next_follow_up && <p className="text-xs text-navy/50">Next: {formatDate(f.next_follow_up)}</p>}
          </li>
        ))}
      </ol>

      {/* Next contact */}
      {leadStatus === "open" && canEdit && (
        <form action={action} className="space-y-4 rounded-lg border border-navy/10 p-4">
          <input type="hidden" name="id" value={id} />
          <p className="text-sm font-bold">Follow-up {followUps.length + 1}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="How">
              <select name="method" defaultValue="call" className={inputClass}>
                {Object.entries(FOLLOW_UP_METHOD_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Outcome" className="sm:col-span-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOutcome("follow_up")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-bold ${
                    outcome === "follow_up" ? "border-mint bg-mint-50" : "border-navy/15 text-navy/60"
                  }`}
                >
                  Still interested
                </button>
                <button
                  type="button"
                  onClick={() => setOutcome("lost")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-bold ${
                    outcome === "lost" ? "border-red-300 bg-red-50 text-red-700" : "border-navy/15 text-navy/60"
                  }`}
                >
                  Lost
                </button>
              </div>
              <input type="hidden" name="outcome" value={outcome} />
            </Field>
          </div>
          <Field label="What was said">
            <textarea name="note" rows={2} required className={inputClass} />
          </Field>
          {outcome === "follow_up" ? (
            <Field label="Next follow-up">
              <input name="next_follow_up" type="date" min={today} defaultValue={inTwoDays} required className={inputClass} />
            </Field>
          ) : (
            <Field label="Why lost">
              <select name="lost_reason" required defaultValue="" className={inputClass}>
                <option value="" disabled>
                  Choose…
                </option>
                {LOST_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {state?.error && <Notice tone="error">{state.error}</Notice>}
          {state?.ok && <Notice tone="ok">{state.ok}</Notice>}
          <Submit lost={outcome === "lost"} />
        </form>
      )}
    </div>
  );
}
