import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Staff } from "@/lib/auth";

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
