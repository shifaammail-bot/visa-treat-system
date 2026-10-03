"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCountries, getProducts } from "@/lib/catalogue";
import { canSeeClient, getStaffList, requireStaff } from "@/lib/context";
import { dbError } from "@/lib/db";
import { CHANNEL_LABEL, VISA_TYPE_LABEL, dubaiDate, dubaiDatePlus } from "@/lib/format";
import { can } from "@/lib/permissions";
import { amount, parseQuote } from "@/lib/quote-input";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentMethod, Source, VisaType } from "@/lib/types";

export type SaleResult = { error: string; applicationId?: string } | null;

const METHODS: PaymentMethod[] = ["cash", "card", "bank transfer", "link", "cheque"];

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

/**
 * A direct sale in one step: client, sale, document number, and optionally
 * the payment taken there and then. Ends on the issued document.
 */
export async function createSale(_prev: SaleResult, formData: FormData): Promise<SaleResult> {
  const staff = await requireStaff();
  if (!can.editSale(staff.role)) return { error: "Your role can't issue quotations or invoices." };

  const kind = text(formData, "kind") === "quotation" ? "quotation" : "invoice";
  const admin = createAdminClient();

  // Price, company and visa — the same checks as the quote form.
  const parsed = await parseQuote(formData, staff);
  if ("error" in parsed) return parsed;
  const quote = parsed.values;

  // Destination and visa type: from the catalogue product, or as entered.
  const product = quote.product_id ? (await getProducts()).find((p) => p.id === quote.product_id) : undefined;
  const countryCode = quote.country_code ?? text(formData, "country_code");
  if (!(await getCountries()).some((c) => c.code === countryCode)) return { error: "Choose the destination." };
  const visaType = (product?.visa_type ?? text(formData, "visa_type")) as VisaType;
  if (!(visaType in VISA_TYPE_LABEL)) return { error: "Choose a visa type." };


  const channel = text(formData, "source") as Source;
  if (!(channel in CHANNEL_LABEL)) return { error: "Choose how the client found us (channel)." };

  // Payment taken now (invoices only).
  const paid = kind === "invoice" ? amount(formData, "paid_amount") : 0;
  if (paid === null) return { error: "The amount paid must be a number." };
  const method = text(formData, "paid_method") as PaymentMethod;
  if (paid > 0 && !METHODS.includes(method)) return { error: "Choose how they paid." };
  if (paid > quote.selling_price * quote.quantity + 0.001) {
    return { error: "The amount paid is more than the invoice total." };
  }

  let consultant = staff.email;
  const picked = text(formData, "consultant");
  if (picked && can.assignConsultant(staff.role)) {
    const match = (await getStaffList()).find((s) => s.active && s.email.toLowerCase() === picked.toLowerCase());
    if (!match) return { error: "That consultant isn't an active staff member." };
    consultant = match.email;
  }

  // The client: a repeat customer, or new.
  let clientId: string;
  let createdClient = false;
  const existing = text(formData, "client_id");
  if (existing) {
    const { data: client } = await admin.from("clients").select("id, created_by").eq("id", existing).maybeSingle();
    if (!client || !(await canSeeClient(staff, client))) return { error: "Client not found." };
    clientId = client.id;
  } else {
    const fullName = text(formData, "full_name");
    const nationality = text(formData, "nationality");
    const phone = text(formData, "phone");
    const email = text(formData, "email");
    if (!fullName) return { error: "Enter the client's name." };
    if (!nationality) return { error: "Enter the client's nationality." };
    if (!phone && !email) return { error: "Enter a phone number or an email for the client." };

    const { data, error } = await admin
      .from("clients")
      .insert({
        created_by: staff.email,
        full_name: fullName,
        nationality,
        phone: phone || null,
        email: email || null,
        client_ref: text(formData, "client_ref") || null,
      })
      .select("id")
      .single();
    if (error) return { error: `Could not save the client: ${dbError(error.message)}` };
    clientId = data.id;
    createdClient = true;
  }

  const { data: app, error: appError } = await admin
    .from("visa_applications")
    .insert({
      ...quote,
      country_code: countryCode,
      created_by: staff.email,
      consultant,
      client_id: clientId,
      visa_type: visaType,
      source: channel,
      notes: text(formData, "notes") || null,
      status: "quoted",
      lead_status: kind === "invoice" ? "won" : "open",
      closed_at: kind === "invoice" ? dubaiDate() : null,
      next_follow_up: kind === "invoice" ? null : dubaiDatePlus(2),
    })
    .select("id")
    .single();
  if (appError) {
    if (createdClient) await admin.from("clients").delete().eq("id", clientId);
    return { error: `Could not save the sale: ${dbError(appError.message)}` };
  }

  const { error: numberError } = await admin.rpc("assign_document_number", {
    p_application: app.id,
    p_series: kind,
  });
  if (numberError) {
    return {
      error: `The sale was saved but the ${kind} could not be numbered: ${dbError(numberError.message)}`,
      applicationId: app.id,
    };
  }

  if (paid > 0) {
    const { error: payError } = await admin.rpc("record_payment", {
      p_application: app.id,
      p_amount: paid,
      p_method: method,
      p_paid_at: dubaiDate(),
      p_reference: text(formData, "paid_reference"),
      p_received_by: staff.email,
      p_note: null,
    });
    if (payError) {
      return {
        error: `The invoice was issued but the payment was not recorded: ${dbError(payError.message)}`,
        applicationId: app.id,
      };
    }
  }

  for (const path of ["/", "/applications", "/quotations", "/invoices", "/clients"]) revalidatePath(path);
  redirect(`/documents/${app.id}?type=${kind}&new=1`);
}
