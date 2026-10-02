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

const round2 = (value: number): number => Math.round(value * 100) / 100

const positive = (value: number): number => (Number.isFinite(value) ? Math.max(0, value) : 0)

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
  const people = Math.max(1, Math.floor(positive(quantity)) || 1)
  const grandTotal = round2(positive(sellingPrice) * people)

  if (!vatRegistered) {
    return { taxable: 0, vat: 0, grandTotal, taxable_supply: false }
  }

  const charged = positive(serviceCharge) * people
  const taxable = round2(charged / (1 + VAT_RATE))

  return {
    taxable,
    vat: round2(taxable * VAT_RATE),
    grandTotal,
    taxable_supply: true,
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
  const people = Math.max(1, Math.floor(positive(quantity)) || 1)
  return round2((positive(sellingPrice) - positive(costPrice) - positive(governmentFee)) * people)
}

/** "AED 789.00" — two decimals, because these go on a tax invoice. */
export const money = (value: number | null | undefined): string => {
  const n = Number(value ?? 0)
  const safe = Number.isFinite(n) ? n : 0
  return `AED ${safe.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * What is still owed on an application.
 *
 * Computed from the payments every time, never stored. A stored balance and a
 * payment row disagree the first time somebody edits one, and then nobody
 * knows which is right.
 */
export function balance(grandTotal: number, payments: readonly { amount: number }[]): number {
  const paid = payments.reduce((sum, payment) => sum + positive(payment.amount), 0)
  return round2(positive(grandTotal) - paid)
}
