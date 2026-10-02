import { describe, expect, it } from "vitest";
import { balance, margin, money, vatSplit } from "../lib/vat";

/**
 * The same arithmetic as the set_visa_vat trigger (supabase/migrations/001),
 * written out in SQL terms so the two can be compared line by line:
 *   charged  := service_charge * quantity
 *   taxable  := round(charged / 1.05, 2)
 *   vat      := round(taxable * 0.05, 2)
 *   total    := round(selling_price * quantity, 2)
 */
function trigger(selling: number, service: number, quantity: number, registered: boolean) {
  const round2 = (v: number) => Math.round(v * 100) / 100;
  if (!registered) return { taxable: 0, vat: 0, grandTotal: round2(selling * quantity) };
  const taxable = round2((service * quantity) / 1.05);
  return { taxable, vat: round2(taxable * 0.05), grandTotal: round2(selling * quantity) };
}

describe("vatSplit", () => {
  it("matches the worked example for one person", () => {
    expect(vatSplit(789, 80, 1)).toEqual({ taxable: 76.19, vat: 3.81, grandTotal: 789, taxable_supply: true });
  });

  it("matches the worked example for two people", () => {
    expect(vatSplit(789, 80, 2)).toEqual({ taxable: 152.38, vat: 7.62, grandTotal: 1578, taxable_supply: true });
  });

  it("charges no VAT when the company is not registered, and the client pays the same", () => {
    expect(vatSplit(789, 80, 2, false)).toEqual({ taxable: 0, vat: 0, grandTotal: 1578, taxable_supply: false });
  });

  it("treats zero or junk quantity as one person", () => {
    expect(vatSplit(500, 70, 0).grandTotal).toBe(500);
    expect(vatSplit(500, 70, Number.NaN).grandTotal).toBe(500);
  });

  it("agrees with the database trigger across a spread of prices", () => {
    for (const selling of [100, 300, 615, 789, 900, 1030, 2499.5]) {
      for (const service of [0, 50, 70, 80, 99.99, 150, 250, 350]) {
        for (const quantity of [1, 2, 3, 4, 7]) {
          for (const registered of [true, false]) {
            const js = vatSplit(selling, service, quantity, registered);
            const db = trigger(selling, service, quantity, registered);
            expect({ taxable: js.taxable, vat: js.vat, grandTotal: js.grandTotal }).toEqual(db);
          }
        }
      }
    }
  });
});

describe("margin, balance and money", () => {
  it("takes cost and the government fee off the selling price", () => {
    expect(margin(789, 100, 609, 2)).toBe(160);
  });

  it("computes the balance from payments", () => {
    expect(balance(1578, [{ amount: 500 }, { amount: 78 }])).toBe(1000);
  });

  it("formats AED with two decimals", () => {
    expect(money(1578)).toBe("AED 1,578.00");
  });
});
