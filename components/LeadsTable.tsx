import { SOURCE_LABEL, formatDate } from "@/lib/format";
import type { Issuer } from "@/lib/issuers";
import type { ApplicationRow } from "@/lib/types";
import { Empty, LeadBadge, TableLink, TableWrap, tdClass, thClass } from "@/components/ui";

type Props = {
  rows: ApplicationRow[];
  issuers: Issuer[];
  staffName: (email: string) => string;
  today: string;
  empty: React.ReactNode;
};

/** The CRM work list: who to contact, what they want, where they came from, when to call. */
export function LeadsTable({ rows, issuers, staffName, today, empty }: Props) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  const brand = (id: string | null) => issuers.find((i) => i.id === id)?.trade_name ?? "—";

  return (
    <TableWrap>
      <thead>
        <tr>
          <th className={thClass}>Client</th>
          <th className={thClass}>Wants</th>
          <th className={thClass}>Came from</th>
          <th className={thClass}>Handled by</th>
          <th className={thClass}>Contact</th>
          <th className={thClass}>Next follow-up</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const followUps = r.followups?.length ?? 0;
          const last = followUps
            ? r.followups.map((f) => f.created_at).sort().at(-1)!
            : r.created_at;
          const overdue = r.lead_status === "open" && !!r.next_follow_up && r.next_follow_up < today;
          const dueToday = r.lead_status === "open" && r.next_follow_up === today;
          return (
            <tr key={r.id} className="hover:bg-navy/[0.02]">
              <td className={tdClass}>
                <TableLink href={`/applications/${r.id}`}>{r.client?.full_name ?? "—"}</TableLink>
                <p className="text-xs text-navy/50">
                  {r.ref}
                  {r.client?.phone || r.client?.email ? ` · ${r.client?.phone ?? r.client?.email}` : ""}
                </p>
              </td>
              <td className={tdClass}>
                <p>{r.country?.name ?? r.country_code}</p>
                <p className="text-xs text-navy/50">{r.product_name}</p>
              </td>
              <td className={tdClass}>
                <p>{r.source ? SOURCE_LABEL[r.source] : "—"}</p>
                <p className="text-xs text-navy/50">{brand(r.issued_by)}</p>
              </td>
              <td className={tdClass}>{staffName(r.consultant)}</td>
              <td className={tdClass}>
                <p>{followUps ? `${followUps} follow-up${followUps === 1 ? "" : "s"}` : "New"}</p>
                <p className="text-xs text-navy/50">Last {formatDate(last)}</p>
              </td>
              <td className={tdClass}>
                {r.lead_status === "open" ? (
                  <span
                    className={`font-bold ${overdue ? "text-red-600" : dueToday ? "text-amber-700" : "text-navy"}`}
                  >
                    {r.next_follow_up
                      ? overdue
                        ? `Overdue · ${formatDate(r.next_follow_up)}`
                        : dueToday
                          ? "Today"
                          : formatDate(r.next_follow_up)
                      : "Not set"}
                  </span>
                ) : (
                  <span className="flex flex-col items-start gap-1">
                    <LeadBadge status={r.lead_status} />
                    {r.lead_status === "lost" && r.lost_reason && (
                      <span className="text-xs text-navy/50">{r.lost_reason}</span>
                    )}
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </TableWrap>
  );
}
