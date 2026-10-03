import type { Role, Staff } from "@/lib/auth";

const ROLES: Role[] = ["super_admin", "admin", "manager", "consultant", "accounts"];

const isAdmin = (role: Role) => role === "super_admin" || role === "admin";

/**
 * What each role may do. Every server action checks these again — hiding a
 * button is not the enforcement.
 *
 * - super_admin (Shifaam): everything, and the only one who can change or
 *   delete what is already recorded — issued invoices, lead details and
 *   status, payments, clients — and manage staff.
 * - admin (founders): sees everything and does the daily work: leads,
 *   follow-ups, quotes, invoices, payments.
 * - manager: the daily work for their brands (staff.issuer_ids; null = all).
 * - consultant: only their own leads and sales; never cost or profit.
 * - accounts: every invoice and payment; records payments only.
 */
export const can = {
  seeCosts: (role: Role) => isAdmin(role) || role === "manager",
  createLead: (role: Role) => role !== "accounts",
  /** Price a quote and issue quotations and invoices. */
  editSale: (role: Role) => role !== "accounts",
  /** Change or delete what's already recorded: invoices, leads, payments, clients. */
  correct: (role: Role) => role === "super_admin",
  /** Correct an invoice after it has been issued. Super admin only; every edit is recorded. */
  editIssuedInvoice: (role: Role) => role === "super_admin",
  editClient: (role: Role) => role === "super_admin",
  /** Every role may take a payment on a sale it can see. */
  recordPayment: (role: Role) => ROLES.includes(role),
  assignConsultant: (role: Role) => isAdmin(role) || role === "manager",
  manageStaff: (role: Role) => role === "super_admin",
  /** Founders only for this phase; staff-scoped reports come later. */
  seeReports: (role: Role) => isAdmin(role),
};

/** Restricted to some brands (a manager with issuer_ids set). */
export function brandLimit(staff: Staff): string[] | null {
  return staff.role === "manager" && staff.issuer_ids ? staff.issuer_ids : null;
}

/** Whether this staff member may open this application at all. */
export function canSeeApplication(
  staff: Staff,
  app: { consultant: string; issued_by: string | null }
): boolean {
  if (staff.role === "consultant") return app.consultant.toLowerCase() === staff.email.toLowerCase();
  const limit = brandLimit(staff);
  if (limit) return app.issued_by === null || limit.includes(app.issued_by);
  return true;
}
