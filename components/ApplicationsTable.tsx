import { formatDate, num } from "@/lib/format";
import type { Issuer } from "@/lib/issuers";
import { balanceOf } from "@/lib/queries";
import type { ApplicationRow } from "@/lib/types";
import { money } from "@/lib/vat";
import { Empty, StatusBadge, TableLink, TableWrap, tdClass, thClass } from "@/components/ui";

type Column = "client" | "trip" | "brand" | "consultant" | "status" | "total" | "balance" | "document";

type Props = {
  rows: ApplicationRow[];
  issuers: Issuer[];
  staffName: (email: string) => string;
  columns: Column[];
  /** Which number to show in the document column. */
  document?: "quotation" | "invoice";
  empty: React.ReactNode;
};

export function ApplicationsTable({ rows, issuers, staffName, columns, document, empty }: Props) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  const show = (c: Column) => columns.includes(c);
  const issuerName = (id: string | null) =>
    id ? issuers.find((i) => i.id === id)?.trade_name ?? "Other brand" : "Not chosen";

  return (
    <TableWrap>
      <thead>
        <tr>
          <th className={thClass}>{document ? "Document" : "Ref"}</th>
          {show("client") && <th className={thClass}>Client</th>}
          {show("trip") && <th className={thClass}>Visa</th>}
          {show("brand") && <th className={thClass}>Brand</th>}
          {show("consultant") && <th className={thClass}>Consultant</th>}
          {show("status") && <th className={thClass}>Status</th>}
          {show("total") && <th className={`${thClass} text-right`}>Total</th>}
          {show("balance") && <th className={`${thClass} text-right`}>Balance</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const number = document === "invoice" ? row.invoice_number : row.quotation_number;
          const date = document === "invoice" ? row.invoice_date : document ? row.quotation_date : row.created_at;
          const owed = balanceOf(row);
          return (
            <tr key={row.id} className="hover:bg-navy/[0.02]">
              <td className={tdClass}>
                <TableLink href={`/applications/${row.id}`}>{document ? number : row.ref}</TableLink>
                <p className="text-xs text-navy/50">
                  {document ? `${row.ref} · ` : ""}
                  {formatDate(date)}
                </p>
              </td>
              {show("client") && (
                <td className={tdClass}>
                  <p className="font-semibold">{row.client?.full_name ?? "—"}</p>
                  <p className="text-xs text-navy/50">{row.client?.phone ?? row.client?.email ?? ""}</p>
                </td>
              )}
              {show("trip") && (
                <td className={tdClass}>
                  <p>{row.product_name}</p>
                  <p className="text-xs text-navy/50">
                    {row.quantity > 1 ? `${row.quantity} guests · ` : ""}
                    {row.travel_from ? `Travels ${formatDate(row.travel_from)}` : row.country?.name}
                  </p>
                </td>
              )}
              {show("brand") && <td className={tdClass}>{issuerName(row.issued_by)}</td>}
              {show("consultant") && <td className={tdClass}>{staffName(row.consultant)}</td>}
              {show("status") && (
                <td className={tdClass}>
                  <StatusBadge status={row.status} />
                </td>
              )}
              {show("total") && (
                <td className={`${tdClass} text-right tabular-nums`}>
                  {num(row.grand_total) > 0 ? money(row.grand_total) : "—"}
                </td>
              )}
              {show("balance") && (
                <td
                  className={`${tdClass} text-right font-semibold tabular-nums ${
                    owed > 0 ? "text-red-600" : "text-emerald-700"
                  }`}
                >
                  {owed > 0 ? money(owed) : "Paid"}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </TableWrap>
  );
}
