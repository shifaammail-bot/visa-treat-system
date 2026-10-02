import type { Role, Staff } from "@/lib/auth";

const ROLES: Role[] = ["admin", "manager", "consultant", "accounts"];

/**
 * What each role may do. Every server action checks these again — hiding a
 * button is not the enforcement.
 *
 * - admin: everything.
 * - manager: everything for their brands (staff.issuer_ids; null = all).
 * - consultant: only their own leads and applications; never cost or margin.
 * - accounts: every invoice and payment; cannot edit clients or sales.
 */
export const can = {
  seeCosts: (role: Role) => role === "admin" || role === "manager",
  createLead: (role: Role) => role !== "accounts",
  editSale: (role: Role) => role !== "accounts",
  /** Correct an invoice after it has been issued. Admins only; every edit is recorded. */
  editIssuedInvoice: (role: Role) => role === "admin",
  editClient: (role: Role) => role !== "accounts",
  /** Every role may take a payment on an application it can see. */
  recordPayment: (role: Role) => ROLES.includes(role),
  assignConsultant: (role: Role) => role === "admin" || role === "manager",
  manageStaff: (role: Role) => role === "admin",
  /** Admin-only for this phase; staff-scoped reports come later. */
  seeReports: (role: Role) => role === "admin",
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
