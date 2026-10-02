"use server";

import { revalidatePath } from "next/cache";
import { PLACEHOLDER_TERMS, getProducts } from "@/lib/catalogue";
import { loadApplication, requireStaff } from "@/lib/context";
import { dubaiDate } from "@/lib/format";
import { allowedIssuers, getIssuers } from "@/lib/issuers";
import { can } from "@/lib/permissions";
import { NEXT_STATUS } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentMethod, Status } from "@/lib/types";

export type ActionResult = { error?: string; ok?: string } | null;

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

function amount(formData: FormData, key: string): number | null {
  const raw = text(formData, key);
  if (raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/** The database's message without the Postgres prefix. */
const dbError = (message: string) => message.replace(/^.*?ERROR:\s*/i, "");

function refresh(id: string) {
  revalidatePath(`/applications/${id}`);
  revalidatePath("/applications");
  revalidatePath("/leads");
  revalidatePath("/quotations");
  revalidatePath("/invoices");
  revalidatePath("/");
}

export async function saveQuote(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const staff = await requireStaff();
  const id = text(formData, "id");
  const app = await loadApplication(id, staff);

  if (!can.editSale(staff.role)) return { error: "Your role can't change prices." };
  if (app.invoice_number) return { error: "This application is invoiced; its figures are locked." };
  if (app.status === "cancelled") return { error: "This application is cancelled." };

  const issuers = allowedIssuers(await getIssuers(), staff);
  const issuer = issuers.find((i) => i.id === text(formData, "issued_by"));
  if (!issuer) return { error: "Choose which company issues this." };

  const productId = text(formData, "product_id");
  const product = productId ? (await getProducts()).find((p) => p.id === productId) : undefined;
  if (productId && !product) return { error: "That visa product no longer exists." };

  const productName = product ? product.name : text(formData, "product_name");
  if (!productName) return { error: "Describe the visa (or pick a product)." };

  const quantity = Math.floor(Number(text(formData, "quantity")));
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
    return { error: "Number of people must be between 1 and 99." };
  }

  const governmentFee = amount(formData, "government_fee");
  const serviceCharge = amount(formData, "service_charge");
  const sellingPrice = amount(formData, "selling_price");
  if (governmentFee === null || serviceCharge === null || sellingPrice === null) {
    return { error: "Fees and prices must be numbers of zero or more." };
  }
  if (sellingPrice <= 0) return { error: "Enter the selling price per person." };
  if (sellingPrice + 0.001 < governmentFee + serviceCharge) {
    return {
      error:
        "The selling price per person must cover the government fee plus the service charge — the service charge is VAT-inclusive and sits inside the price.",
    };
  }

  const update: Record<string, unknown> = {
    issued_by: issuer.id,
    product_id: product?.id ?? null,
    product_name: productName,
    country_code: product?.country_code ?? app.country_code,
    quantity,
    government_fee: governmentFee,
    service_charge: serviceCharge,
    selling_price: sellingPrice,
    terms: text(formData, "terms") || product?.terms || PLACEHOLDER_TERMS,
    status: app.status === "enquiry" ? "quoted" : app.status,
  };

  // Cost price is admin/manager only. Others never see it, so never overwrite it.
  if (can.seeCosts(staff.role)) {
    const cost = amount(formData, "cost_price");
    if (cost === null) return { error: "Cost price must be a number of zero or more." };
    update.cost_price = cost;
  }

  const { error } = await createAdminClient().from("visa_applications").update(update).eq("id", id);
  if (error) return { error: dbError(error.message) };

  refresh(id);
  return { ok: app.status === "enquiry" ? "Quote saved. The lead is now quoted." : "Quote saved." };
}

async function assign(id: string, series: "quotation" | "invoice"): Promise<ActionResult> {
  const staff = await requireStaff();
  const app = await loadApplication(id, staff);
  if (!can.editSale(staff.role)) return { error: "Your role can't issue documents." };
  if (!app.issued_by || app.grand_total <= 0) return { error: "Save a quote with a company and a price first." };

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

export async function setStatus(id: string, status: Status): Promise<ActionResult> {
  const staff = await requireStaff();
  const app = await loadApplication(id, staff);
  if (!can.editSale(staff.role)) return { error: "Your role can't change status." };
  if (!NEXT_STATUS[app.status].includes(status)) {
    return { error: `Can't move from ${app.status} to ${status}.` };
  }

  const today = dubaiDate();
  const update: Record<string, unknown> = { status };
  if (status === "submitted") update.submitted_at = today;
  if (status === "approved" || status === "rejected") update.decided_at = today;

  const { error } = await createAdminClient().from("visa_applications").update(update).eq("id", id);
  if (error) return { error: dbError(error.message) };

  refresh(id);
  return { ok: "Status updated." };
}

const METHODS: PaymentMethod[] = ["cash", "card", "bank transfer", "link", "cheque"];

export async function recordPayment(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const staff = await requireStaff();
  const id = text(formData, "id");
  await loadApplication(id, staff);
  if (!can.recordPayment(staff.role)) return { error: "Your role can't record payments." };

  const value = amount(formData, "amount");
  if (!value || value <= 0) return { error: "Enter the amount received." };
  const method = text(formData, "method") as PaymentMethod;
  if (!METHODS.includes(method)) return { error: "Choose how they paid." };
  const paidAt = text(formData, "paid_at");
  if (paidAt && !/^\d{4}-\d{2}-\d{2}$/.test(paidAt)) return { error: "Check the date." };
  if (paidAt > dubaiDate()) return { error: "The payment date can't be in the future." };

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
  return { ok: receipt ? `Payment recorded as receipt ${receipt}.` : "Payment recorded." };
}
