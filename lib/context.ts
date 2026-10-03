import { notFound, redirect } from "next/navigation";
import { getSession, type Staff } from "@/lib/auth";
import { allowedIssuers, getIssuers, type Issuer } from "@/lib/issuers";
import { brandLimit, canSeeApplication } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Application } from "@/lib/types";

export type Context = {
  staff: Staff;
  /** Issuers this person may see. */
  issuers: Issuer[];
};

/** The signed-in staff member, or a redirect. Use at the top of every page and action. */
export async function requireStaff(): Promise<Staff> {
  const session = await getSession();
  if (session.status === "signed-out") redirect("/login");
  if (session.status === "no-access") redirect("/");
  return session.staff;
}

export async function getContext(): Promise<Context> {
  const staff = await requireStaff();
  const issuers = allowedIssuers(await getIssuers(), staff);
  return { staff, issuers };
}

/**
 * Narrows an applications query to what this person may see: consultants
 * their own, brand-limited managers their brands plus leads with no company
 * chosen yet.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scopeApplications<Q extends { eq: any; or: any }>(query: Q, { staff }: Context): Q {
  let q = query;
  if (staff.role === "consultant") q = q.eq("consultant", staff.email);

  const limit = brandLimit(staff);
  if (limit) {
    const ids = limit.length ? limit.join(",") : "00000000-0000-0000-0000-000000000000";
    q = q.or(`issued_by.in.(${ids}),issued_by.is.null`);
  }
  return q;
}

/** Loads one application the signed-in person may see, or 404s. */
export async function loadApplication(id: string, staff: Staff): Promise<Application> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await createAdminClient()
    .from("visa_applications")
    .select("*")
    .eq("id", id)
    .maybeSingle<Application>();
  if (!data || !canSeeApplication(staff, data)) notFound();
  return data;
}

/**
 * Whether this person may see a client. Consultants see clients they created
 * or have an application for; brand-limited managers see clients with an
 * application in their brands (or none yet).
 */
export async function canSeeClient(
  staff: Staff,
  client: { id: string; created_by: string | null }
): Promise<boolean> {
  if (staff.role === "super_admin" || staff.role === "admin" || staff.role === "accounts") return true;
  if (staff.role === "manager" && !brandLimit(staff)) return true;
  if (staff.role === "consultant" && client.created_by?.toLowerCase() === staff.email.toLowerCase()) {
    return true;
  }
  const { data: apps } = await createAdminClient()
    .from("visa_applications")
    .select("consultant, issued_by")
    .eq("client_id", client.id);
  if (staff.role === "manager" && (apps ?? []).length === 0) return true;
  return (apps ?? []).some((a) => canSeeApplication(staff, a));
}

/** Fetches every row of a query, a page at a time (PostgREST caps a response at 1000). */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const size = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await build(from, from + size - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < size) return rows;
  }
}

export type StaffName = { email: string; full_name: string; active: boolean; role: Staff["role"] };

/** Every staff member, for names and the consultant picker. */
export async function getStaffList(): Promise<StaffName[]> {
  const { data } = await createAdminClient()
    .from("staff")
    .select("email, full_name, active, role")
    .order("full_name");
  return data ?? [];
}

export function nameOf(list: StaffName[], email: string | null): string {
  if (!email) return "—";
  return list.find((s) => s.email.toLowerCase() === email.toLowerCase())?.full_name ?? email;
}
