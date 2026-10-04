/**
 * The business arithmetic, on integer fils: what a sale totals, the VAT in
 * it, its margin, and what a supplier's bill line costs. Pages call these;
 * no component does money maths of its own.
 */
import {
  VAT_BPS,
  add,
  convertToAed,
  multiply,
  percent,
  splitInclusive,
  subtract,
  sum,
  type Fils,
} from "@/lib/money";

/** A document is for at least one person; zero or junk means one. */
export function guests(quantity: number): number {
  return Number.isFinite(quantity) && quantity >= 1 ? Math.floor(quantity) : 1;
}

export type SaleTotals = {
  /** Selling price × guests: what the client pays. */
  grandTotal: Fils;
  /** The service fee for everyone with the tax taken out. 0 if not VAT registered. */
  taxable: Fils;
  /** The tax inside the service fee. 0 if not VAT registered. */
  vat: Fils;
};

/**
 * Totals for one sale. The service fee is VAT-inclusive and is the only taxable
 * part; the tax comes out of it rather than going on top. Mirrors the
 * set_visa_vat database trigger step for step.
 */
export function saleTotals(
  sellingPrice: Fils,
  serviceCharge: Fils,
  quantity: number,
  vatRegistered: boolean,
): SaleTotals {
  const people = guests(quantity);
  const grandTotal = multiply(Math.max(0, sellingPrice), people);
  if (!vatRegistered) return { grandTotal, taxable: 0, vat: 0 };
  const { taxable, vat } = splitInclusive(multiply(Math.max(0, serviceCharge), people));
  return { grandTotal, taxable, vat };
}

/** Margin on a sale: revenue excluding VAT, minus cost. Never on VAT-inclusive figures. */
export function margin(grandTotal: Fils, vat: Fils, cost: Fils): Fils {
  return subtract(subtract(grandTotal, vat), cost);
}

/**
 * The margin the reports used before cost accounting: (selling − cost −
 * government fee) × guests, on VAT-inclusive prices. Kept so the two can be
 * shown side by side while the switch beds in.
 */
export function marginInclusive(sellingPrice: Fils, costPrice: Fils, governmentFee: Fils, quantity: number): Fils {
  const perGuest = subtract(subtract(Math.max(0, sellingPrice), Math.max(0, costPrice)), Math.max(0, governmentFee));
  return multiply(perGuest, guests(quantity));
}

/** What is still owed: total minus payments. Negative means a refund is due. */
export function balance(grandTotal: Fils, payments: readonly Fils[]): Fils {
  return subtract(Math.max(0, grandTotal), sum(payments.map((p) => Math.max(0, p))));
}

/**
 * VAT on a supplier bill line. A VAT-registered supplier charges 5 % on top;
 * pass-through costs (government fees paid on the client's behalf) never
 * carry VAT.
 */
export function billLineVat(cost: Fils, supplierVatRegistered: boolean, passThrough: boolean): Fils {
  if (!supplierVatRegistered || passThrough) return 0;
  return percent(cost, VAT_BPS);
}

export type ForeignLine = { cost: Fils; vat: Fils };
export type FrozenLine = ForeignLine & { costAed: Fils; vatAed: Fils };

/**
 * Fix the AED value of a foreign-currency bill at posting, with the rate of
 * that day (six-decimal integer). Each line is converted and rounded once;
 * the bill total is the sum of the converted lines. Store the result: later
 * rate changes must never touch it.
 */
export function freezeBill(lines: readonly ForeignLine[], rateMicros: number): { lines: FrozenLine[]; totalAed: Fils; vatAed: Fils } {
  const frozen = lines.map((l) => ({
    ...l,
    costAed: convertToAed(l.cost, rateMicros),
    vatAed: convertToAed(l.vat, rateMicros),
  }));
  return {
    lines: frozen,
    totalAed: add(...frozen.map((l) => l.costAed + l.vatAed)),
    vatAed: add(...frozen.map((l) => l.vatAed)),
  };
}
