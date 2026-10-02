"use server";

import { revalidatePath } from "next/cache";
import { canSeeClient, requireStaff } from "@/lib/context";
import { can } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export type ClientResult = { error?: string; ok?: string } | null;

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function updateClient(_prev: ClientResult, formData: FormData): Promise<ClientResult> {
  const staff = await requireStaff();
  if (!can.editClient(staff.role)) return { error: "Your role can't edit client records." };

  const id = text(formData, "id");
  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("id, created_by").eq("id", id).maybeSingle();
  if (!client || !(await canSeeClient(staff, client))) return { error: "Client not found." };

  const fullName = text(formData, "full_name");
  const nationality = text(formData, "nationality");
  const phone = text(formData, "phone");
  const email = text(formData, "email");
  if (!fullName || !nationality) return { error: "Name and nationality are required." };
  if (!phone && !email) return { error: "Keep at least a phone number or an email." };

  const { error } = await admin
    .from("clients")
    .update({
      full_name: fullName,
      nationality,
      phone: phone || null,
      email: email || null,
      client_ref: text(formData, "client_ref") || null,
      notes: text(formData, "notes") || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
  return { ok: "Saved. Documents already issued show the new details next time they're opened." };
}
