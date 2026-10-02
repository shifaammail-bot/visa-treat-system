"use server";

import { revalidatePath } from "next/cache";
import { loadApplication, requireStaff } from "@/lib/context";
import { dbError } from "@/lib/db";
import { dubaiDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { amount, parseQuote } from "@/lib/quote-input";
import { NEXT_STATUS } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentMethod, Status } from "@/lib/types";

export type ActionResult = { error?: string; ok?: string } | null;

const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

function refresh(id: string) {
  revalidatePath(`/applications/${id}`);
  revalidatePath("/applications");
  revalidatePath("/leads");
  revalidatePath("/quotations");
  revalidatePath("/invoices");
  revalidatePath("/");
}

export async function saveQuote(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const staff = await requireStaff();
  const id = text(formData, "id");
  const app = await loadApplication(id, staff);

  if (!can.editSale(staff.role))
    return { error: "Your role can't change prices." };
  if (app.status === "cancelled")
    return { error: "This application is cancelled." };
  if (app.invoice_number && !can.editIssuedInvoice(staff.role)) {
    return {
      error:
        "This application is invoiced. Only an admin can change its figures.",
    };
  }

  const parsed = await parseQuote(formData, staff);
  if ("error" in parsed) return parsed;
  const { values } = parsed;

  // An issued invoice: admins correct it through the database function, which
  // keeps the number, date and company, records the edit and refuses a total
  // below what has been paid.
  if (app.invoice_number) {
    if (values.issued_by !== app.issued_by) {
      return {
        error: "An issued invoice stays with the company that issued it.",
      };
    }
    const { error } = await createAdminClient().rpc(
      "admin_update_invoiced_application",
      {
        p_application: id,
        p_product_id: values.product_id,
        p_product_name: values.product_name,
        p_quantity: values.quantity,
        p_service_charge: values.service_charge,
        p_selling_price: values.selling_price,
        p_cost_price: values.cost_price ?? null,
        p_terms: values.terms,
        p_edited_by: staff.email,
      },
    );
    if (error) return { error: dbError(error.message) };
    refresh(id);
    return {
      ok: `Invoice ${app.invoice_number} updated. The PDF now shows the new figures.`,
    };
  }

  const update = {
    ...values,
    country_code: values.country_code ?? app.country_code,
    status: app.status === "enquiry" ? "quoted" : app.status,
  };

  const { error } = await createAdminClient()
    .from("visa_applications")
    .update(update)
    .eq("id", id);
  if (error) return { error: dbError(error.message) };

  refresh(id);
  return {
    ok:
      app.status === "enquiry"
        ? "Quote saved. The lead is now quoted."
        : "Quote saved.",
  };
}

async function assign(
  id: string,
  series: "quotation" | "invoice",
): Promise<ActionResult> {
  const staff = await requireStaff();
  const app = await loadApplication(id, staff);
  if (!can.editSale(staff.role))
    return { error: "Your role can't issue documents." };
  if (!app.issued_by || app.grand_total <= 0)
    return { error: "Save a quote with a company and a price first." };

  const { error } = await createAdminClient().rpc("assign_document_number", {
    p_application: id,
    p_series: series,
  });
  if (error) return { error: dbError(error.message) };

  refresh(id);
  return { ok: series === "invoice" ? "Invoice issued." : "Quotation issued." };
}

export async function issueQuotation(id: string) {
  return assign(id, "quotation");
}

export async function convertToInvoice(id: string) {
  return assign(id, "invoice");
}

export async function setStatus(
  id: string,
  status: Status,
): Promise<ActionResult> {
  const staff = await requireStaff();
  const app = await loadApplication(id, staff);
  if (!can.editSale(staff.role))
    return { error: "Your role can't change status." };
  if (!NEXT_STATUS[app.status].includes(status)) {
    return { error: `Can't move from ${app.status} to ${status}.` };
  }

  const today = dubaiDate();
  const update: Record<string, unknown> = { status };
  if (status === "submitted") update.submitted_at = today;
  if (status === "approved" || status === "rejected") update.decided_at = today;

  const { error } = await createAdminClient()
    .from("visa_applications")
    .update(update)
    .eq("id", id);
  if (error) return { error: dbError(error.message) };

  refresh(id);
  return { ok: "Status updated." };
}

const METHODS: PaymentMethod[] = [
  "cash",
  "card",
  "bank transfer",
  "link",
  "cheque",
];

export async function recordPayment(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const staff = await requireStaff();
  const id = text(formData, "id");
  await loadApplication(id, staff);
  if (!can.recordPayment(staff.role))
    return { error: "Your role can't record payments." };

  const value = amount(formData, "amount");
  if (!value || value <= 0) return { error: "Enter the amount received." };
  const method = text(formData, "method") as PaymentMethod;
  if (!METHODS.includes(method)) return { error: "Choose how they paid." };
  const paidAt = text(formData, "paid_at");
  if (paidAt && !/^\d{4}-\d{2}-\d{2}$/.test(paidAt))
    return { error: "Check the date." };
  if (paidAt > dubaiDate())
    return { error: "The payment date can't be in the future." };

  const { data, error } = await createAdminClient().rpc("record_payment", {
    p_application: id,
    p_amount: value,
    p_method: method,
    p_paid_at: paidAt || null,
    p_reference: text(formData, "reference"),
    p_received_by: staff.email,
    p_note: text(formData, "note"),
  });
  if (error) return { error: dbError(error.message) };

  refresh(id);
  const receipt = (data as { receipt_number?: string } | null)?.receipt_number;
  return {
    ok: receipt
      ? `Payment recorded as receipt ${receipt}.`
      : "Payment recorded.",
  };
}
