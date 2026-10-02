import { describe, expect, it } from "vitest";
import type { DocumentData } from "../lib/documents";
import { renderDocumentPdf } from "../lib/pdf/render";

const base = (slug: string, overrides: Partial<DocumentData["issuer"]> = {}): DocumentData => ({
  kind: "invoice",
  number: "VT-INV-2888",
  date: "2026-10-03",
  issuer: {
    id: "x", slug, trade_name: "Brand", legal_name: "Company L.L.C", trn: "100603181700003", vat_registered: true,
    licence_no: "1021948", address: "Dubai", email: "a@example.com", phone: "+971", accent_colour: "#000000",
    invoice_prefix: "VT", website: "", bank_name: null, bank_account_name: null, bank_iban: null, bank_swift: null,
    ...overrides,
  },
  app: {
    id: "x", ref: "VT-0001", quantity: 2, product_name: "Schengen tourist visa", service_charge: 250,
    selling_price: 615, taxable_amount: 476.19, vat_amount: 23.81, grand_total: 1230, quotation_number: null, terms: "One\nTwo",
  },
  client: { full_name: "Test Client", nationality: "Indian", phone: null, email: null, client_ref: null },
  countryName: "Schengen Area",
  payments: [{ amount: 500 }],
});

describe("invoice PDF", () => {
  it.each(["visatreat", "arabiers", "tourmate", "unknown"])("renders for %s", async (slug) => {
    const pdf = await renderDocumentPdf(base(slug));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5000);
  });

  it("renders a company with no TRN", async () => {
    const pdf = await renderDocumentPdf(base("tourmate", { trn: null, vat_registered: false }));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
