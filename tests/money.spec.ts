import { describe, expect, it } from "vitest";
import { balance, billLineVat, freezeBill, margin, marginInclusive, saleTotals } from "../lib/costing";
import {
  add,
  convertToAed,
  divRoundHalfUp,
  formatAed,
  fromFils,
  fromNumeric,
  multiply,
  percent,
  splitInclusive,
  subtract,
  sum,
  toFils,
  tryFils,
} from "../lib/money";
import { vatSplit } from "../lib/vat";

describe("toFils", () => {
  it("accepts two decimals and rejects three", () => {
    expect(toFils("12.34")).toBe(1234);
    expect(() => toFils("12.345")).toThrow(/two decimals/);
  });

  it("reads the ways people type amounts", () => {
    expect(toFils("625")).toBe(62500);
    expect(toFils("1,234.5")).toBe(123450);
    expect(toFils(" AED 0.05 ")).toBe(5);
    expect(toFils("-10.10")).toBe(-1010);
    expect(tryFils("abc")).toBeNull();
    expect(tryFils("1.2.3")).toBeNull();
    expect(tryFils("")).toBeNull();
  });
});

describe("fromFils and formatAed", () => {
  it("formats with two decimals and thousands", () => {
    expect(fromFils(123456)).toBe("1,234.56");
    expect(fromFils(5)).toBe("0.05");
    expect(fromFils(-2500)).toBe("-25.00");
    expect(formatAed(99999999999)).toBe("AED 999,999,999.99");
  });

  it("reads numeric(…,2) values from the database exactly", () => {
    expect(fromNumeric(0.29)).toBe(29); // 0.29 * 100 is 28.999… in floating point
    expect(fromNumeric(1.005)).toBe(101);
    expect(fromNumeric("476.19")).toBe(47619);
    expect(fromNumeric(null)).toBe(0);
  });
});

describe("rounding is half up, once per line", () => {
  it("0.5 fils rounds up and 0.4 rounds down", () => {
    expect(divRoundHalfUp(5, 10)).toBe(1); // 0.005 AED
    expect(divRoundHalfUp(4, 10)).toBe(0); // 0.004 AED
    expect(divRoundHalfUp(-5, 10)).toBe(-1); // away from zero, like Postgres
  });

  it("percent in basis points", () => {
    expect(percent(100000, 500)).toBe(5000);
    expect(percent(1, 500)).toBe(0);
    expect(percent(10, 500)).toBe(1); // 0.5 fils, half up
    expect(percent(8, 500)).toBe(0); // 0.4 fils
  });

  it("VAT on the smallest and a very large amount", () => {
    expect(percent(1, 500)).toBe(0);
    expect(percent(999_999_999, 500)).toBe(50_000_000); // 49,999,999.95 → 50,000,000
  });

  it("a seven-line invoice total equals the sum of its rounded lines", () => {
    // Awkward fractions: each line's VAT is a fraction of a fils before rounding.
    const lineCosts = [333, 667, 1001, 12345, 99999, 7, 250005];
    const lines = lineCosts.map((cost) => ({ cost, vat: percent(cost, 500) }));
    const stored = add(...lines.map((l) => l.cost + l.vat));
    expect(stored).toBe(sum(lines.map((l) => l.cost)) + sum(lines.map((l) => l.vat)));
    // And it is NOT the same as rounding VAT once on the running total.
    const vatOnTotal = percent(sum(lineCosts), 500);
    expect(sum(lines.map((l) => l.vat))).not.toBe(vatOnTotal);
  });
});

describe("arithmetic guards", () => {
  it("refuses fractions of a fils and unsafe numbers", () => {
    expect(() => add(1.5)).toThrow(RangeError);
    expect(() => multiply(100, 1.5)).toThrow(RangeError);
    expect(() => subtract(Number.MAX_SAFE_INTEGER, -10)).toThrow(RangeError);
  });
});

describe("VAT-inclusive split matches the database trigger", () => {
  it("worked examples from lib/vat.ts", () => {
    expect(splitInclusive(8000)).toEqual({ taxable: 7619, vat: 381 });
    expect(saleTotals(78900, 8000, 1, true)).toEqual({ grandTotal: 78900, taxable: 7619, vat: 381 });
    expect(saleTotals(78900, 8000, 2, true)).toEqual({ grandTotal: 157800, taxable: 15238, vat: 762 });
    expect(saleTotals(78900, 8000, 2, false)).toEqual({ grandTotal: 157800, taxable: 0, vat: 0 });
  });

  it("vatSplit (AED API) and saleTotals (fils) agree across a sweep", () => {
    for (let selling = 0; selling <= 300000; selling += 4999) {
      for (const service of [0, 1, 7, 5000, 6000, 8000, 9999, 25000]) {
        for (const q of [1, 2, 3, 7]) {
          const fils = saleTotals(selling, service, q, true);
          const aed = vatSplit(selling / 100, service / 100, q, true);
          expect(fromNumeric(aed.taxable)).toBe(fils.taxable);
          expect(fromNumeric(aed.vat)).toBe(fils.vat);
          expect(fromNumeric(aed.grandTotal)).toBe(fils.grandTotal);
        }
      }
    }
  });
});

describe("margin", () => {
  it("is revenue excluding VAT minus cost", () => {
    const t = saleTotals(62500, 6000, 1, true); // 625 with a 60 fee
    expect(margin(t.grandTotal, t.vat, 10000)).toBe(62500 - 286 - 10000);
  });

  it("the old VAT-inclusive margin is still available for comparison", () => {
    expect(marginInclusive(61500, 40000, 0, 2)).toBe(43000);
  });

  it("balance goes negative when overpaid", () => {
    expect(balance(62500, [30000])).toBe(32500);
    expect(balance(62500, [62500, 1000])).toBe(-1000);
  });
});

describe("supplier bills", () => {
  it("VAT only for registered suppliers and never on pass-through costs", () => {
    expect(billLineVat(20000, true, false)).toBe(1000);
    expect(billLineVat(20000, false, false)).toBe(0);
    expect(billLineVat(20000, true, true)).toBe(0);
  });

  it("a foreign-currency bill freezes its AED amount at posting", () => {
    // USD 100.00 + VAT USD 5.00 at 3.672500
    const posted = freezeBill([{ cost: 10000, vat: 500 }], 3_672_500);
    expect(posted.lines[0].costAed).toBe(36725);
    expect(posted.lines[0].vatAed).toBe(1836); // 18.3625 → 18.36
    expect(posted.totalAed).toBe(38561);

    // Stored as posted. A later rate does not change the stored bill.
    const stored = structuredClone(posted);
    const later = freezeBill([{ cost: 10000, vat: 500 }], 3_700_000);
    expect(later.totalAed).not.toBe(stored.totalAed);
    expect(stored.totalAed).toBe(38561);
  });

  it("converts large amounts without leaving safe integers", () => {
    expect(convertToAed(1_000_000_000, 3_672_500)).toBe(3_672_500_000);
  });
});
