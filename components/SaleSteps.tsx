import { Check } from "lucide-react";

type Props = {
  /** Where the client found us, e.g. "Social media". */
  channel: string;
  followUps: number;
  invoiced: boolean;
  /** Paid in full. */
  paid: boolean;
  /** Something paid, not all. */
  advance: boolean;
  lost: boolean;
};

/** Where a client is: lead → follow-ups → invoice → paid (or lost). */
export function SaleSteps({ channel, followUps, invoiced, paid, advance, lost }: Props) {
  const steps = [
    { label: `Lead · ${channel}`, done: true },
    {
      label: followUps ? `${followUps} follow-up${followUps === 1 ? "" : "s"}` : "Follow-up",
      done: followUps > 0 || invoiced,
    },
    { label: "Invoice", done: invoiced },
    { label: advance && !paid ? "Advance paid" : "Paid", done: paid, partial: advance && !paid },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <div>
      {lost && <p className="mb-2 text-xs font-bold uppercase tracking-wide text-red-600">Lost</p>}
      <ol className={`flex flex-wrap items-center gap-y-2 ${lost ? "opacity-50" : ""}`}>
        {steps.map((step, i) => {
          const isCurrent = i === current && !lost;
          return (
            <li key={i} className="flex items-center">
              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                  step.done
                    ? "bg-mint-50 text-navy"
                    : "partial" in step && step.partial
                      ? "bg-amber-50 text-amber-800 ring-2 ring-amber-300"
                      : isCurrent
                        ? "bg-white text-navy ring-2 ring-mint"
                        : "text-navy/40"
                }`}
              >
                {step.done ? (
                  <Check className="h-3.5 w-3.5 text-mint-600" />
                ) : (
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                      isCurrent ? "bg-mint text-navy" : "bg-navy/10"
                    }`}
                  >
                    {i + 1}
                  </span>
                )}
                {step.label}
              </span>
              {i < steps.length - 1 && <span className="mx-1.5 h-px w-4 bg-navy/15 sm:w-6" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
