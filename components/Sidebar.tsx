"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  FileCheck2,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Stamp,
  UserCog,
  Users,
  X,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { signOut } from "@/app/actions";
import { BrandLogo } from "@/components/BrandLogo";

const ICONS: Record<NavItem["icon"], React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  leads: Inbox,
  applications: Stamp,
  quotations: FileText,
  invoices: FileCheck2,
  clients: Users,
  reports: BarChart3,
  staff: UserCog,
};

const ROLE_LABEL = {
  admin: "Admin",
  manager: "Manager",
  consultant: "Consultant",
  accounts: "Accounts",
} as const;

type Props = {
  items: NavItem[];
  staff: { full_name: string; email: string; role: keyof typeof ROLE_LABEL };
  /** Show the quick "New invoice / quote" buttons. */
  canSell: boolean;
};

export function Sidebar({ items, staff, canSell }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-navy/10 bg-white px-4 py-3 md:hidden">
        <BrandLogo slug="visatreat" tradeName="Visa Treat" accentColour="#2FE0C2" on="light" className="h-6" />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-1.5 text-navy hover:bg-navy/5"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <aside
        className={`${
          open ? "flex" : "hidden"
        } w-full flex-col border-b border-navy/10 bg-[#FAFAFB] text-navy md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r`}
      >
        {/* All sales are Visa Treat's; the issuing company is chosen per quote. */}
        <div className="hidden px-5 pb-4 pt-5 md:block">
          <BrandLogo slug="visatreat" tradeName="Visa Treat" accentColour="#2FE0C2" on="light" className="h-10" />
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.25em] text-navy/40">Desk</p>
        </div>

        {canSell && (
          <div className="flex gap-2 px-3 pb-3 pt-3 md:pt-0">
            <Link
              href="/sales/new?type=invoice"
              onClick={() => setOpen(false)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-mint px-3 py-2 text-sm font-bold text-navy shadow-sm hover:bg-mint-600"
            >
              <Plus className="h-4 w-4" />
              Invoice
            </Link>
            <Link
              href="/sales/new?type=quotation"
              onClick={() => setOpen(false)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-navy/15 bg-white px-3 py-2 text-sm font-bold text-navy shadow-sm hover:border-navy/30"
            >
              <Plus className="h-4 w-4" />
              Quote
            </Link>
          </div>
        )}

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-white text-navy shadow-sm ring-1 ring-navy/10"
                    : "text-navy/60 hover:bg-navy/5 hover:text-navy"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-mint-600" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-navy/10 p-4">
          <p className="truncate text-sm font-semibold">{staff.full_name}</p>
          <p className="truncate text-xs text-navy/50">
            {ROLE_LABEL[staff.role]} · {staff.email}
          </p>
          <form action={signOut} className="mt-3">
            <button
              type="submit"
              className="flex items-center gap-2 text-xs font-semibold text-navy/50 hover:text-navy"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
