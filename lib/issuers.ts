import { cache } from "react";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Staff } from "@/lib/auth";
import { ALL_BRANDS, BRAND_COOKIE } from "@/lib/brand";

export { ALL_BRANDS, BRAND_COOKIE };

export type Issuer = {
  id: string;
  slug: string;
  trade_name: string;
  legal_name: string;
  trn: string | null;
  vat_registered: boolean;
  licence_no: string | null;
  address: string;
  email: string;
  phone: string;
  accent_colour: string;
  invoice_prefix: string;
};

/** Active issuers, in display order. Cached per request. */
export const getIssuers = cache(async (): Promise<Issuer[]> => {
  const { data, error } = await createAdminClient()
    .from("issuers")
    .select(
      "id, slug, trade_name, legal_name, trn, vat_registered, licence_no, address, email, phone, accent_colour, invoice_prefix"
    )
    .eq("active", true)
    .order("sort_order");

  if (error) throw new Error(`Could not load issuers: ${error.message}`);
  return data ?? [];
});

/** The issuers this staff member may see. Managers are limited to their brands. */
export function allowedIssuers(issuers: Issuer[], staff: Staff): Issuer[] {
  if (staff.role !== "manager" || !staff.issuer_ids) return issuers;
  return issuers.filter((i) => staff.issuer_ids!.includes(i.id));
}

/**
 * The brand picked in the sidebar switcher: an issuer id, or "all".
 * Falls back to "all" (or the only allowed brand) if the cookie is stale.
 */
export function selectedBrand(allowed: Issuer[]): string {
  const value = cookies().get(BRAND_COOKIE)?.value;
  if (value && allowed.some((i) => i.id === value)) return value;
  if (allowed.length === 1) return allowed[0].id;
  return ALL_BRANDS;
}
