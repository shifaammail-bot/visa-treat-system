import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Role = "admin" | "manager" | "consultant" | "accounts";

export type Staff = {
  email: string;
  full_name: string;
  role: Role;
  /** Brands a manager covers. Null means all of them. */
  issuer_ids: string[] | null;
  active: boolean;
};

export type Session =
  | { status: "signed-out" }
  | { status: "no-access"; email: string }
  | { status: "ok"; email: string; staff: Staff };

/**
 * Who is signed in, and their staff row.
 *
 * Signing in to Supabase is not enough: the email must also have an active row
 * in `staff`, which only admins create. Cached per request.
 */
export const getSession = cache(async (): Promise<Session> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return { status: "signed-out" };

  const { data: staff } = await createAdminClient()
    .from("staff")
    .select("email, full_name, role, issuer_ids, active")
    .ilike("email", user.email)
    .maybeSingle<Staff>();

  if (!staff || !staff.active) return { status: "no-access", email: user.email };
  return { status: "ok", email: user.email, staff };
});
