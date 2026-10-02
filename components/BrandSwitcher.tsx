"use client";

import { useTransition } from "react";
import { ChevronDown } from "lucide-react";
import type { Issuer } from "@/lib/issuers";
import { ALL_BRANDS } from "@/lib/brand";
import { setBrand } from "@/app/actions";
import { BrandLogo } from "@/components/BrandLogo";

type Props = {
  issuers: Issuer[];
  selected: string;
};

export function BrandSwitcher({ issuers, selected }: Props) {
  const [pending, startTransition] = useTransition();
  const current = issuers.find((i) => i.id === selected);

  return (
    <div className={pending ? "opacity-60" : undefined}>
      <div className="flex h-9 items-center">
        {current ? (
          <BrandLogo
            slug={current.slug}
            tradeName={current.trade_name}
            accentColour={current.accent_colour}
            on="dark"
          />
        ) : (
          <span className="text-lg font-extrabold tracking-tight">
            Visa Treat <span className="text-mint">Desk</span>
          </span>
        )}
      </div>

      <label className="relative mt-3 block">
        <span className="sr-only">Brand</span>
        <select
          value={selected}
          disabled={pending || issuers.length < 2}
          onChange={(e) => {
            const value = e.target.value;
            startTransition(() => setBrand(value));
          }}
          className="w-full appearance-none rounded-lg border border-navy-600 bg-navy-800 py-2 pl-3 pr-8 text-sm font-semibold text-white focus:border-mint focus:outline-none disabled:cursor-default"
        >
          {issuers.length > 1 && <option value={ALL_BRANDS}>All brands</option>}
          {issuers.map((issuer) => (
            <option key={issuer.id} value={issuer.id}>
              {issuer.trade_name}
            </option>
          ))}
        </select>
        {issuers.length > 1 && (
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
        )}
      </label>
    </div>
  );
}
