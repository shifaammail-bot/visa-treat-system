import { Check } from "lucide-react";

type Props = {
  direct: boolean;
  quoted: boolean;
  invoiced: boolean;
  paid: boolean;
  submitted: boolean;
  decision: "approved" | "rejected" | null;
  cancelled: boolean;
};

/** Where a sale is: lead → quote → invoice → paid → submitted → decision. */
export function SaleSteps({ direct, quoted, invoiced, paid, submitted, decision, cancelled }: Props) {
  const steps = [
    { label: direct ? "Direct sale" : "Lead", done: true },
    { label: "Quote", done: quoted },
    { label: "Invoice", done: invoiced },
    { label: "Paid", done: paid },
    { label: "Submitted", done: submitted },
    { label: decision === "rejected" ? "Rejected" : "Approved", done: decision !== null },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <div>
      {cancelled && <p className="mb-2 text-xs font-bold uppercase tracking-wide text-red-600">Cancelled</p>}
      <ol className={`flex flex-wrap items-center gap-y-2 ${cancelled ? "opacity-50" : ""}`}>
        {steps.map((step, i) => {
          const isCurrent = i === current && !cancelled;
          const rejected = step.label === "Rejected";
          return (
            <li key={step.label} className="flex items-center">
              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                  step.done
                    ? rejected
                      ? "bg-red-50 text-red-700"
                      : "bg-mint-50 text-navy"
                    : isCurrent
                      ? "bg-white text-navy ring-2 ring-mint"
                      : "text-navy/40"
                }`}
              >
                {step.done ? (
                  <Check className={`h-3.5 w-3.5 ${rejected ? "text-red-600" : "text-mint-600"}`} />
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
