"use server";

import { revalidatePath } from "next/cache";
import { dbError } from "@/lib/db";
import {
  SOURCE_LABEL,
  STATUS_LABEL,
  VISA_TYPE_LABEL,
  dubaiDate,
} from "@/lib/format";
import { getCountries } from "@/lib/catalogue";
import { getStaffList, loadApplication, requireStaff } from "@/lib/context";
import { allowedIssuers, getIssuers } from "@/lib/issuers";
import { can } from "@/lib/permissions";
import { amount, parseQuote } from "@/lib/quote-input";
import { NEXT_STATUS } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentMethod, Source, Status, VisaType } from "@/lib/types";

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

/**
 * An admin correction to any field of a sale, through the database function
 * that lifts the invoice lock and records who edited and when.
 */
async function adminUpdate(
  id: string,
  changes: Record<string, unknown>,
  editedBy: string,
): Promise<string | null> {
  const { error } = await createAdminClient().rpc("admin_update_application", {
    p_application: id,
    p_changes: changes,
    p_edited_by: editedBy,
  });
  if (!error) return null;
  if (
    /admin_update_application/.test(error.message) &&
    /(schema cache|does not exist|Could not find)/i.test(error.message)
  ) {
    return "The database hasn't been updated for admin editing yet. Run supabase/migrations/008-admin-edit-everything.sql in the Supabase SQL editor, then try again.";
  }
  if (/invoice_number_key/.test(error.message))
    return "That invoice number is already used by another sale.";
  if (/quotation_number_key/.test(error.message))
    return "That quotation number is already used by another sale.";
  return dbError(error.message);
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
  const isAdmin = can.editIssuedInvoice(staff.role);
  if (app.status === "cancelled" && !isAdmin)
    return { error: "This application is cancelled." };
  if (app.invoice_number && !isAdmin) {
    return {
      error:
        "This application is invoiced. Only an admin can change its figures.",
    };
  }

  const parsed = await parseQuote(formData, staff);
  if ("error" in parsed) return parsed;
  const { values } = parsed;

  // Admins: any sale, issued or not, any company — through the audited function.
  if (isAdmin) {
    const error = await adminUpdate(
      id,
      {
        ...values,
        cost_price: values.cost_price ?? app.cost_price,
        country_code: values.country_code ?? app.country_code,
        status: app.status === "enquiry" ? "quoted" : app.status,
      },
      staff.email,
    );
    if (error) return { error };
    refresh(id);
    return {
      ok: app.invoice_number
        ? `Saved. Invoice ${app.invoice_number} now shows the new figures.`
        : "Quote saved.",
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

const STATUSES = Object.keys(STATUS_LABEL) as Status[];
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * Destination, visa type, source, consultant and notes — and for admins also
 * status, company-independent document numbers and dates.
 */
export async function saveDetails(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const staff = await requireStaff();
  const id = text(formData, "id");
  const app = await loadApplication(id, staff);
  if (!can.editSale(staff.role))
    return { error: "Your role can't change sale details." };
  const isAdmin = can.editIssuedInvoice(staff.role);

  const countryCode = text(formData, "country_code");
  if (!(await getCountries()).some((c) => c.code === countryCode))
    return { error: "Choose the destination." };
  const visaType = text(formData, "visa_type") as VisaType;
  if (!(visaType in VISA_TYPE_LABEL)) return { error: "Choose a visa type." };
  const source = text(formData, "source") as Source;
  if (!(source in SOURCE_LABEL)) return { error: "Choose the source." };

  const changes: Record<string, unknown> = {
    country_code: countryCode,
    visa_type: visaType,
    source,
    notes: text(formData, "notes") || null,
  };

  const consultant = text(formData, "consultant");
  if (consultant && can.assignConsultant(staff.role)) {
    const match = (await getStaffList()).find(
      (s) => s.email.toLowerCase() === consultant.toLowerCase(),
    );
    if (!match) return { error: "That consultant isn't on the staff list." };
    changes.consultant = match.email;
  }

  if (!isAdmin) {
    const { error } = await createAdminClient()
      .from("visa_applications")
      .update(changes)
      .eq("id", id);
    if (error) return { error: dbError(error.message) };
    refresh(id);
    return { ok: "Details saved." };
  }

  // Admin-only fields.
  const status = text(formData, "status") as Status;
  if (!STATUSES.includes(status)) return { error: "Choose a status." };
  changes.status = status;

  const issuerId = text(formData, "issued_by");
  if (issuerId) {
    const issuers = allowedIssuers(await getIssuers(), staff);
    if (!issuers.some((i) => i.id === issuerId))
      return { error: "Choose the issuing company." };
    changes.issued_by = issuerId;
  }

  for (const key of ["invoice_number", "quotation_number"] as const) {
    const value = text(formData, key);
    if (key === "invoice_number" && !value && app.invoice_number) {
      return {
        error:
          "An issued invoice needs a number. Change it, but don't leave it empty.",
      };
    }
    changes[key] = value || null;
  }
  for (const key of [
    "invoice_date",
    "quotation_date",
    "submitted_at",
    "decided_at",
  ] as const) {
    const value = text(formData, key);
    if (value && !isDate(value)) return { error: "Check the dates." };
    if (key === "invoice_date") {
      if (value) changes.invoice_date = value;
    } else {
      changes[key] = value || null;
    }
  }

  const error = await adminUpdate(id, changes, staff.email);
  if (error) return { error };
  refresh(id);
  return { ok: "Details saved." };
}

/** Correct a payment: amount, method, date, reference, note. Admins only. */
export async function updatePayment(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!can.editIssuedInvoice(staff.role))
    return { error: "Only an admin can change a recorded payment." };
  const id = text(formData, "id");
  const paymentId = text(formData, "payment_id");
  await loadApplication(id, staff);

  const value = amount(formData, "amount");
  if (!value || value <= 0) return { error: "Enter the amount." };
  const method = text(formData, "method") as PaymentMethod;
  if (!METHODS.includes(method)) return { error: "Choose how they paid." };
  const paidAt = text(formData, "paid_at");
  if (!isDate(paidAt)) return { error: "Check the date." };

  const { error } = await createAdminClient()
    .from("payments")
    .update({
      amount: value,
      method,
      paid_at: paidAt,
      reference: text(formData, "reference") || null,
      note: text(formData, "note") || null,
    })
    .eq("id", paymentId)
    .eq("application_id", id);
  if (error) return { error: dbError(error.message) };
  refresh(id);
  return { ok: "Payment updated." };
}

/** Remove a payment entered by mistake. Admins only. */
export async function deletePayment(
  id: string,
  paymentId: string,
): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!can.editIssuedInvoice(staff.role))
    return { error: "Only an admin can remove a payment." };
  await loadApplication(id, staff);
  const { error } = await createAdminClient()
    .from("payments")
    .delete()
    .eq("id", paymentId)
    .eq("application_id", id);
  if (error) return { error: dbError(error.message) };
  refresh(id);
  return { ok: "Payment removed." };
}
