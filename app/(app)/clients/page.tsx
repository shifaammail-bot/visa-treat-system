import { getContext, scopeApplications } from "@/lib/context";
import { formatDate } from "@/lib/format";
import { brandLimit } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Client } from "@/lib/types";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { Empty, TableLink, TableWrap, tdClass, thClass } from "@/components/ui";

export default async function ClientsPage({ searchParams }: { searchParams: { q?: string } }) {
  const ctx = await getContext();
  const { staff } = ctx;
  const admin = createAdminClient();

  // Which clients this person may see: everyone for admin/accounts/unrestricted
  // managers, otherwise clients behind the applications they can see (plus
  // clients a consultant created themselves).
  const restricted = staff.role === "consultant" || !!brandLimit(staff);
  let ids: string[] | null = null;
  if (restricted) {
    const { data: apps } = await scopeApplications(
      admin.from("visa_applications").select("client_id"),
      ctx
    );
    ids = Array.from(new Set((apps ?? []).map((a) => a.client_id as string)));
  }

  let query = admin
    .from("clients")
    .select("*, applications:visa_applications(count)")
    .order("created_at", { ascending: false })
    .limit(500);

  const q = searchParams.q?.trim().replace(/[,()%]/g, " ");
  if (q) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,passport_no.ilike.%${q}%`);
  if (ids) {
    query =
      staff.role === "consultant"
        ? query.or(`id.in.(${ids.join(",") || "00000000-0000-0000-0000-000000000000"}),created_by.eq."${staff.email}"`)
        : query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data } = await query;
  const clients = (data ?? []) as (Client & { applications: { count: number }[] })[];

  return (
    <>
      <PageHeader title="Clients" description="Everyone who has enquired or applied." />
      <div className="space-y-4 px-4 py-6 md:px-8">
        <ListToolbar path="/clients" search={searchParams.q} />
        {clients.length === 0 ? (
          <Empty>No clients found. Clients are added from the lead form.</Empty>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th className={thClass}>Name</th>
                <th className={thClass}>Nationality</th>
                <th className={thClass}>Contact</th>
                <th className={thClass}>Passport</th>
                <th className={`${thClass} text-right`}>Applications</th>
                <th className={thClass}>Added</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-navy/[0.02]">
                  <td className={tdClass}>
                    <TableLink href={`/clients/${c.id}`}>{c.full_name}</TableLink>
                  </td>
                  <td className={tdClass}>{c.nationality}</td>
                  <td className={tdClass}>
                    <p>{c.phone ?? "—"}</p>
                    <p className="text-xs text-navy/50">{c.email ?? ""}</p>
                  </td>
                  <td className={`${tdClass} font-mono text-xs`}>{c.passport_no ?? "—"}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{c.applications?.[0]?.count ?? 0}</td>
                  <td className={tdClass}>{formatDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </div>
    </>
  );
}
