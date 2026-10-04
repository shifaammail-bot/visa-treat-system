/**
 * The arithmetic, and the one rule the whole system turns on.
 *
 * Lifted from the Arabiers visa feature, which has been issuing real UAE tax
 * invoices, and generalised for an issuer that may not be VAT registered. The
 * numbers in the tests come from invoices that were actually sent. Do not
 * rewrite the arithmetic to look tidier.
 *
 * It is stated here and enforced a second time in the database, by the trigger
 * that fills taxable_amount, vat_amount and grand_total. This one is what the
 * form shows while a consultant types; the database's is what ends up on the
 * invoice. They must agree, and tests/vat.spec.ts checks that they do.
 */

import { balance as feeBalance, marginInclusive, saleTotals } from "@/lib/costing"
import { formatAed, fromNumeric, toNumeric, type Fils } from "@/lib/money"

/** UAE VAT. Unchanged since 2018, and not a figure to make configurable. */
export const VAT_RATE = 0.05

export type VatSplit = {
  /** The company's own fee for everyone on the document, tax taken back out. */
  taxable: number
  /** The tax inside those service charges. */
  vat: number
  /** What the client pays: the per-person price times the number of people. */
  grandTotal: number
  /**
   * False when the issuing company has no TRN.
   *
   * The document then shows no VAT line at all and is headed "Invoice" rather
   * than "Tax Invoice". A VAT line without a TRN behind it is a document that
   * should not exist.
   */
  taxable_supply: boolean
}

// Since the money foundation, every figure here is worked out in integer fils
// (lib/money.ts, lib/costing.ts) and only turned back into AED at the end, so
// none of this arithmetic runs in floating point. The results are unchanged;
// tests/vat.spec.ts and tests/money.spec.ts hold them to the trigger.
const toFils = (value: number): Fils => (Number.isFinite(value) ? Math.max(0, fromNumeric(value)) : 0)

/**
 * Splits a visa sale into its taxable part and its tax.
 *
 * `sellingPrice` and `serviceCharge` are both per person, because that is how
 * the rates are quoted and how a consultant has them to hand. `quantity` is
 * how many people are on the one document — a family of four applying together
 * is one invoice, not four.
 *
 * The client pays the price times the quantity and that figure never moves.
 * Inside it sits the service charge, which is the only part the company
 * supplies — the government visa fee is a disbursement and carries no VAT from
 * us. So the charge is treated as VAT-inclusive and the tax comes back out of
 * it rather than going on top.
 *
 * One person on a 789 visa with an 80 charge: 76.19 taxable, 3.81 VAT, 789 to
 * pay. Two people: 152.38 taxable, 7.62 VAT, 1,578 to pay. Adding the VAT on
 * top would overcharge the client by the tax; charging it on the whole 1,578
 * would have the company paying tax on money collected for the government.
 *
 * `vatRegistered` false zeroes the split and says so. The client still pays
 * exactly the same figure — whether the company can reclaim tax is not the
 * client's concern and must not change their price.
 */
export function vatSplit(
  sellingPrice: number,
  serviceCharge: number,
  quantity = 1,
  vatRegistered = true
): VatSplit {
  // A document is for at least one person. Zero would make the whole thing
  // free, which is never what an empty or mistyped field means.
  const totals = saleTotals(toFils(sellingPrice), toFils(serviceCharge), quantity, vatRegistered)
  return {
    taxable: toNumeric(totals.taxable),
    vat: toNumeric(totals.vat),
    grandTotal: toNumeric(totals.grandTotal),
    taxable_supply: vatRegistered,
  }
}

/**
 * What the sale made, after everything paid out on it.
 *
 * The government fee is money that leaves again, so it is subtracted like a
 * cost. Admin-only wherever it is totalled.
 */
export function margin(
  sellingPrice: number,
  costPrice: number,
  governmentFee: number,
  quantity = 1
): number {
  return toNumeric(marginInclusive(toFils(sellingPrice), toFils(costPrice), toFils(governmentFee), quantity))
}

/** "AED 789.00" — two decimals, because these go on a tax invoice. */
export const money = (value: number | null | undefined): string => {
  const n = Number(value ?? 0)
  return formatAed(Number.isFinite(n) ? fromNumeric(n) : 0)
}

/**
 * What is still owed on an application.
 *
 * Computed from the payments every time, never stored. A stored balance and a
 * payment row disagree the first time somebody edits one, and then nobody
 * knows which is right.
 */
export function balance(grandTotal: number, payments: readonly { amount: number }[]): number {
  return toNumeric(feeBalance(toFils(grandTotal), payments.map((p) => toFils(p.amount))))
}
