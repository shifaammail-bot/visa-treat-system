"use server";

import { revalidatePath } from "next/cache";
import { escapeLike, type Role } from "@/lib/auth";
import { requireStaff } from "@/lib/context";
import { getIssuers } from "@/lib/issuers";
import { can } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export type FormResult = { error?: string; ok?: string } | null;

const ROLES: Role[] = ["admin", "manager", "consultant", "accounts"];

async function requireAdmin() {
  const staff = await requireStaff();
  if (!can.manageStaff(staff.role)) throw new Error("Only admins can manage staff.");
  return staff;
}

async function parseBrands(formData: FormData, role: Role): Promise<string[] | null> {
  if (role !== "manager") return null;
  const valid = new Set((await getIssuers()).map((i) => i.id));
  const picked = formData.getAll("issuer_ids").map(String).filter((id) => valid.has(id));
  // Every brand ticked (or none) means all brands.
  return picked.length === 0 || picked.length === valid.size ? null : picked;
}

function parseTarget(formData: FormData): number | null {
  const raw = String(formData.get("monthly_target") ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/** Finds a Supabase Auth user by email (the admin API has no direct lookup). */
async function findAuthUser(email: string) {
  const admin = createAdminClient();
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 1000) return null;
  }
  return null;
}

export async function createStaff(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "") as Role;
  const password = String(formData.get("password") ?? "");

  if (!email.includes("@")) return { error: "Enter a valid email." };
  if (!fullName) return { error: "Enter the person's full name." };
  if (!ROLES.includes(role)) return { error: "Choose a role." };
  if (password.length < 8) return { error: "The temporary password needs at least 8 characters." };

  const admin = createAdminClient();
  const { data: existing } = await admin.from("staff").select("email").ilike("email", escapeLike(email)).maybeSingle();
  if (existing) return { error: `${email} is already on the staff list.` };

  let note = "";
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) {
    // The login may already exist (made in the Supabase dashboard). Keep it.
    const user = await findAuthUser(email);
    if (!user) return { error: `Could not create the login: ${created.error.message}` };
    note = " Their existing login was kept, so the password you typed was not applied.";
  }

  const { error } = await admin.from("staff").insert({
    email,
    full_name: fullName,
    role,
    issuer_ids: await parseBrands(formData, role),
    monthly_target: parseTarget(formData),
    active: true,
  });
  if (error) return { error: `Login created, but the staff record failed: ${error.message}` };

  revalidatePath("/staff");
  return { ok: `${fullName} can now sign in as ${email}.${note}` };
}

export async function updateStaff(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const me = await requireAdmin();
  const email = String(formData.get("email") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "") as Role;
  const active = formData.get("active") === "on";

  if (!fullName) return { error: "Name can't be empty." };
  if (!ROLES.includes(role)) return { error: "Choose a role." };

  const isMe = email.toLowerCase() === me.email.toLowerCase();
  if (isMe && (role !== "admin" || !active)) {
    return { error: "You can't remove your own admin access. Ask another admin." };
  }

  const { error } = await createAdminClient()
    .from("staff")
    .update({
      full_name: fullName,
      role,
      active,
      issuer_ids: await parseBrands(formData, role),
      monthly_target: parseTarget(formData),
    })
    .eq("email", email);
  if (error) return { error: error.message };

  revalidatePath("/staff");
  return { ok: "Saved." };
}

export async function resetPassword(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAdmin();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "At least 8 characters." };

  const user = await findAuthUser(email);
  if (!user) {
    // No login yet (staff row added by SQL). Create one.
    const { error } = await createAdminClient().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    return error ? { error: error.message } : { ok: "Login created with that password." };
  }

  const { error } = await createAdminClient().auth.admin.updateUserById(user.id, { password });
  return error ? { error: error.message } : { ok: "Password changed. Tell them the new one in person." };
}
