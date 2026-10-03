import type { FollowUpMethod, LeadStatus, PaymentMethod, Source, Status, VisaType } from "@/lib/types";

export const STATUS_LABEL: Record<Status, string> = {
  enquiry: "Enquiry",
  quoted: "Quoted",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/** Where a client found us. Asked for every lead and every direct sale. */
export const CHANNEL_LABEL: Record<Exclude<Source, "direct">, string> = {
  google_ads: "Google Ads",
  organic: "Google search (SEO)",
  social: "Social media",
  whatsapp: "WhatsApp",
  referral: "Referral",
  walk_in: "Walk-in",
  repeat: "Repeat client",
  agent: "Agent / partner",
  other: "Other",
};

export const SOURCE_LABEL: Record<Source, string> = {
  ...CHANNEL_LABEL,
  direct: "Not recorded",
};

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  open: "Following up",
  won: "Won",
  lost: "Lost",
};

/** Why a lead was closed as lost. */
export const LOST_REASONS = [
  "Went cold / no reply",
  "Price too high",
  "Chose another agency",
  "Travel plans cancelled",
  "Not eligible",
  "Other",
] as const;

export const FOLLOW_UP_METHOD_LABEL: Record<FollowUpMethod, string> = {
  call: "Call",
  whatsapp: "WhatsApp",
  email: "Email",
  visit: "Visit",
  other: "Other",
};

/** A YYYY-MM-DD date some days from today, in Dubai. */
export function dubaiDatePlus(days: number): string {
  const d = new Date(`${dubaiDate()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

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
