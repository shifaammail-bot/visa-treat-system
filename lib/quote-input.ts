import type { Staff } from "@/lib/auth";
import { PLACEHOLDER_TERMS, getProducts } from "@/lib/catalogue";
import { allowedIssuers, getIssuers } from "@/lib/issuers";
import { can } from "@/lib/permissions";

export type QuoteValues = {
  issued_by: string;
  product_id: string | null;
  product_name: string;
  /** Set when a catalogue product decides the destination. */
  country_code: string | null;
  quantity: number;
  government_fee: number;
  service_charge: number;
  selling_price: number;
  terms: string;
  /** Only present for admins and managers; never overwrite it otherwise. */
  cost_price?: number;
};

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

/** A money field: blank is 0, junk or negative is null. */
export function amount(formData: FormData, key: string): number | null {
  const raw = text(formData, key);
  if (raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/**
 * Reads and checks the quote fields (company, visa, people, fees, price,
 * terms) shared by the quote form and the direct-sale form.
 */
export async function parseQuote(
  formData: FormData,
  staff: Staff
): Promise<{ error: string } | { values: QuoteValues }> {
  const issuers = allowedIssuers(await getIssuers(), staff);
  const issuer = issuers.find((i) => i.id === text(formData, "issued_by"));
  if (!issuer) return { error: "Choose which company issues this." };

  const productId = text(formData, "product_id");
  const product = productId ? (await getProducts()).find((p) => p.id === productId) : undefined;
  if (productId && !product) return { error: "That visa product no longer exists." };

  const productName = product ? product.name : text(formData, "product_name");
  if (!productName) return { error: "Describe the visa (or pick a product)." };

  const quantity = Math.floor(Number(text(formData, "quantity")));
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
    return { error: "Number of people must be between 1 and 99." };
  }

  const governmentFee = amount(formData, "government_fee");
  const serviceCharge = amount(formData, "service_charge");
  const sellingPrice = amount(formData, "selling_price");
  if (governmentFee === null || serviceCharge === null || sellingPrice === null) {
    return { error: "Fees and prices must be numbers of zero or more." };
  }
  if (sellingPrice <= 0) return { error: "Enter the selling price per person." };
  if (sellingPrice + 0.001 < governmentFee + serviceCharge) {
    return {
      error:
        "The selling price per person must cover the government fee plus the service charge — the service charge is VAT-inclusive and sits inside the price.",
    };
  }

  const values: QuoteValues = {
    issued_by: issuer.id,
    product_id: product?.id ?? null,
    product_name: productName,
    country_code: product?.country_code ?? null,
    quantity,
    government_fee: governmentFee,
    service_charge: serviceCharge,
    selling_price: sellingPrice,
    terms: text(formData, "terms") || product?.terms || PLACEHOLDER_TERMS,
  };

  if (can.seeCosts(staff.role)) {
    const cost = amount(formData, "cost_price");
    if (cost === null) return { error: "Cost price must be a number of zero or more." };
    values.cost_price = cost;
  }

  return { values };
}
