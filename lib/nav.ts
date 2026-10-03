import type { Role } from "@/lib/auth";

export type NavItem = {
  href: string;
  label: string;
  icon:
    | "dashboard"
    | "leads"
    | "applications"
    | "quotations"
    | "invoices"
    | "clients"
    | "reports"
    | "staff";
  /** Roles that see this item. Omitted means everyone. */
  roles?: Role[];
};

export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/leads", label: "Leads", icon: "leads", roles: ["admin", "manager", "consultant"] },
  { href: "/quotations", label: "Quotations", icon: "quotations" },
  { href: "/invoices", label: "Invoices", icon: "invoices" },
  { href: "/clients", label: "Clients", icon: "clients" },
  { href: "/reports", label: "Reports", icon: "reports", roles: ["admin"] },
  { href: "/staff", label: "Staff", icon: "staff", roles: ["admin"] },
];

export function navFor(role: Role): NavItem[] {
  return NAV.filter((item) => !item.roles || item.roles.includes(role));
}
