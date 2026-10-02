import type { PaymentMethod, Source, Status, VisaType } from "@/lib/types";

export const STATUS_LABEL: Record<Status, string> = {
  enquiry: "Enquiry",
  quoted: "Quoted",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/** Campaign channels a lead can come from. */
export const LEAD_SOURCE_LABEL: Record<Exclude<Source, "direct">, string> = {
  google_ads: "Google Ads",
  organic: "Organic / SEO",
  whatsapp: "WhatsApp",
  social: "Social media ads",
  agent: "Agent",
  other: "Other",
};

export const SOURCE_LABEL: Record<Source, string> = {
  ...LEAD_SOURCE_LABEL,
  direct: "Direct sale",
};

/** Campaign leads only — direct sales are not leads and don't count toward conversion. */
export const isLead = (row: { source: Source | null }) => row.source !== "direct";

export const VISA_TYPE_LABEL: Record<VisaType, string> = {
  tourist: "Tourist",
  visit: "Visit",
  transit: "Transit",
  business: "Business",
  student: "Student",
  work: "Work",
  other: "Other",
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  "bank transfer": "Bank transfer",
  link: "Payment link",
  cheque: "Cheque",
};

/** Today's date in Dubai, as YYYY-MM-DD. */
export function dubaiDate(at: Date | string = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date(at));
}

/** "3 Oct 2026". Accepts a YYYY-MM-DD date or a timestamp. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: /^\d{4}-\d{2}-\d{2}$/.test(value) ? "UTC" : "Asia/Dubai",
  }).format(date);
}

/** Supabase returns numeric columns as numbers, but be defensive about strings. */
export const num = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};
