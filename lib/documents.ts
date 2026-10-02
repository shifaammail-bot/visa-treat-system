import type { Staff } from "@/lib/auth";
import { loadApplication } from "@/lib/context";
import { getIssuers, type Issuer } from "@/lib/issuers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Application, Client } from "@/lib/types";

export type DocumentKind = "invoice" | "quotation";

export type DocumentIssuer = Issuer & {
  website: string;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_iban: string | null;
  bank_swift: string | null;
};

export type DocumentData = {
  kind: DocumentKind;
  /** The printed number, e.g. VT-INV-0001. */
  number: string;
  /** The printed date (YYYY-MM-DD). */
  date: string;
  issuer: DocumentIssuer;
  app: Pick<
    Application,
    | "id"
    | "ref"
    | "quantity"
    | "product_name"
    | "service_charge"
    | "selling_price"
    | "taxable_amount"
    | "vat_amount"
    | "grand_total"
    | "quotation_number"
    | "terms"
  >;
  client: Pick<Client, "full_name" | "nationality" | "phone" | "email" | "client_ref">;
  countryName: string;
  payments: { amount: number }[];
};

export const parseKind = (value?: string | null): DocumentKind => (value === "invoice" ? "invoice" : "quotation");

/**
 * Everything needed to print one quotation or invoice, or null if that
 * document hasn't been issued. 404s if the viewer may not see the sale.
 */
export async function loadDocument(id: string, kind: DocumentKind, staff: Staff): Promise<DocumentData | null> {
  const app = await loadApplication(id, staff);
  const number = kind === "invoice" ? app.invoice_number : app.quotation_number;
  const date = kind === "invoice" ? app.invoice_date : app.quotation_date;
  if (!number || !date || !app.issued_by) return null;

  const issuer = (await getIssuers()).find((i) => i.id === app.issued_by);
  if (!issuer) return null;

  const admin = createAdminClient();
  const [{ data: client }, { data: extra }, { data: payments }, { data: country }] = await Promise.all([
    admin.from("clients").select("*").eq("id", app.client_id).single<Client>(),
    admin
      .from("issuers")
      .select("bank_name, bank_account_name, bank_iban, bank_swift, website")
      .eq("id", issuer.id)
      .single<Pick<DocumentIssuer, "website" | "bank_name" | "bank_account_name" | "bank_iban" | "bank_swift">>(),
    admin.from("payments").select("amount").eq("application_id", app.id),
    admin.from("countries").select("name").eq("code", app.country_code).maybeSingle(),
  ]);
  if (!client) return null;

  return {
    kind,
    number,
    date,
    issuer: { ...issuer, website: "", bank_name: null, bank_account_name: null, bank_iban: null, bank_swift: null, ...extra },
    app,
    client,
    countryName: country?.name ?? app.country_code,
    payments: payments ?? [],
  };
}
