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
};

export function Sidebar({ items, staff }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between bg-navy px-4 py-3 md:hidden">
        <span className="text-sm font-bold text-white">Visa Treat Desk</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-1.5 text-white hover:bg-navy-700"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <aside
        className={`${
          open ? "flex" : "hidden"
        } w-full flex-col bg-navy text-white md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0`}
      >
        {/* All sales are Visa Treat's; the issuing company is chosen per quote. */}
        <div className="hidden border-b border-navy-700 px-5 py-5 md:block">
          <BrandLogo slug="visatreat" tradeName="Visa Treat" accentColour="#2FE0C2" on="dark" className="h-8" />
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">Desk</p>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-mint/10 text-mint"
                    : "text-white/70 hover:bg-navy-700 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-navy-700 p-4">
          <p className="truncate text-sm font-semibold">{staff.full_name}</p>
          <p className="truncate text-xs text-white/50">
            {ROLE_LABEL[staff.role]} · {staff.email}
          </p>
          <form action={signOut} className="mt-3">
            <button
              type="submit"
              className="flex items-center gap-2 text-xs font-semibold text-white/60 hover:text-mint"
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
