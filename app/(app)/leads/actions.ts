"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCountries } from "@/lib/catalogue";
import { canSeeClient, getStaffList, requireStaff } from "@/lib/context";
import { CHANNEL_LABEL, VISA_TYPE_LABEL, dubaiDate } from "@/lib/format";
import { allowedIssuers, getIssuers } from "@/lib/issuers";
import { can } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Source, VisaType } from "@/lib/types";

export type LeadResult = { error?: string } | null;

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function createLead(_prev: LeadResult, formData: FormData): Promise<LeadResult> {
  const staff = await requireStaff();
  if (!can.createLead(staff.role)) return { error: "Your role can't create leads." };

  const admin = createAdminClient();
  const existingClientId = text(formData, "client_id");

  const countryCode = text(formData, "country_code");
  const visaType = text(formData, "visa_type") as VisaType;
  const source = text(formData, "source") as Source;

  const country = (await getCountries()).find((c) => c.code === countryCode);
  if (!country) return { error: "Choose a destination." };
  if (!(visaType in VISA_TYPE_LABEL)) return { error: "Choose a visa type." };
  if (!(source in CHANNEL_LABEL)) return { error: "Choose the channel the lead came from." };

  const brand = allowedIssuers(await getIssuers(), staff).find((i) => i.id === text(formData, "issued_by"));
  if (!brand) return { error: "Choose which brand the enquiry came through." };

  const nextFollowUp = text(formData, "next_follow_up");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextFollowUp)) return { error: "Set the next follow-up date." };
  if (nextFollowUp < dubaiDate()) return { error: "The next follow-up can't be in the past." };

  const referral = text(formData, "referral");
  const discussed = text(formData, "notes");
  const notes = [referral ? `Referred by / campaign: ${referral}` : "", discussed].filter(Boolean).join("\n");

  // Who handles it. Consultants always get their own leads.
  let consultant = staff.email;
  const picked = text(formData, "consultant");
  if (picked && can.assignConsultant(staff.role)) {
    const match = (await getStaffList()).find(
      (s) => s.active && s.email.toLowerCase() === picked.toLowerCase()
    );
    if (!match) return { error: "That consultant isn't an active staff member." };
    consultant = match.email;
  }

  // The client: an existing one (a repeat customer), or a new record.
  let clientId: string;
  let createdClient = false;
  if (existingClientId) {
    const { data: client } = await admin
      .from("clients")
      .select("id, created_by")
      .eq("id", existingClientId)
      .maybeSingle();
    if (!client || !(await canSeeClient(staff, client))) return { error: "Client not found." };
    clientId = client.id;
  } else {
    const fullName = text(formData, "full_name");
    const nationality = text(formData, "nationality");
    const phone = text(formData, "phone");
    const email = text(formData, "email");
    if (!fullName) return { error: "Enter the client's name." };
    if (!nationality) return { error: "Enter the client's nationality." };
    if (!phone && !email) return { error: "Enter a phone number or an email so we can reach them." };

    const { data, error } = await admin
      .from("clients")
      .insert({
        created_by: staff.email,
        full_name: fullName,
        nationality,
        phone: phone || null,
        email: email || null,
      })
      .select("id")
      .single();
    if (error) return { error: `Could not save the client: ${error.message}` };
    clientId = data.id;
    createdClient = true;
  }

  const { data: app, error } = await admin
    .from("visa_applications")
    .insert({
      created_by: staff.email,
      consultant,
      client_id: clientId,
      country_code: country.code,
      product_name: `${country.name} ${VISA_TYPE_LABEL[visaType].toLowerCase()} visa`,
      visa_type: visaType,
      source,
      issued_by: brand.id,
      notes: notes || null,
      status: "enquiry",
      lead_status: "open",
      next_follow_up: nextFollowUp,
    })
    .select("id")
    .single();

  if (error) {
    if (createdClient) await admin.from("clients").delete().eq("id", clientId);
    return { error: `Could not save the lead: ${error.message}` };
  }

  revalidatePath("/leads");
  revalidatePath("/");
  redirect(`/applications/${app.id}`);
}
