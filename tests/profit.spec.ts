import { describe, expect, it } from "vitest";
import {
  isoWeek,
  monthsEnding,
  profitOf,
  summariseMonth,
  summariseWeeks,
  type SaleRow,
} from "../lib/profit";

const sale = (over: Partial<SaleRow>): SaleRow => ({
  id: Math.random().toString(36),
  ref: "VT-0001",
  created_at: "2026-10-05T08:00:00Z",
  consultant: "a@example.com",
  issued_by: "x",
  product_name: "Schengen",
  visa_type: "tourist",
  source: "organic",
  quantity: 1,
  government_fee: 365,
  selling_price: 615,
  cost_price: 50,
  status: "quoted",
  invoice_number: "VT-INV-0001",
  invoice_date: "2026-10-05",
  client: { full_name: "Test" },
  ...over,
});

describe("isoWeek", () => {
  it("numbers weeks the ISO way", () => {
    expect(isoWeek("2026-10-01")).toEqual({ year: 2026, week: 40 });
    expect(isoWeek("2026-01-01")).toEqual({ year: 2026, week: 1 });
    // 1 Jan 2027 is a Friday, so it belongs to the last week of 2026.
    expect(isoWeek("2027-01-01")).toEqual({ year: 2026, week: 53 });
  });
});

describe("summariseWeeks", () => {
  it("clips boundary weeks to the month so weeks add up to the month", () => {
    const weeks = summariseWeeks([], "2026-10");
    expect(weeks[0]).toMatchObject({ week: 40, from: "2026-10-01", to: "2026-10-04" });
    expect(weeks.at(-1)).toMatchObject({ week: 44, from: "2026-10-26", to: "2026-10-31" });
    expect(weeks).toHaveLength(5);
  });

  it("counts leads by creation date and sales by invoice date", () => {
    const rows = [
      sale({ created_at: "2026-09-30T10:00:00Z", invoice_date: "2026-10-06" }),
      sale({ created_at: "2026-10-02T10:00:00Z", invoice_number: null }),
    ];
    const weeks = summariseWeeks(rows, "2026-10");
    expect(weeks[0]).toMatchObject({ leads: 1, sold: 0 });
    expect(weeks[1]).toMatchObject({ leads: 0, sold: 1, profit: 200 });
  });
});

describe("summariseMonth", () => {
  it("sums profit with margin() and skips cancelled and uninvoiced", () => {
    const rows = [
      sale({ quantity: 2 }),
      sale({ status: "cancelled" }),
      sale({ invoice_number: null }),
      sale({ invoice_date: "2026-09-30" }),
    ];
    const m = summariseMonth(rows, "2026-10");
    expect(m.sales).toHaveLength(1);
    expect(m.profit).toBe(400);
    expect(m.leads).toBe(4);
    expect(profitOf(rows[0])).toBe(400);
  });

  it("counts every enquiry as a lead, including on-the-spot sales", () => {
    const rows = [sale({ source: "walk_in" }), sale({ source: "social" }), sale({ source: "organic", invoice_number: null })];
    const m = summariseMonth(rows, "2026-10");
    expect(m.sales).toHaveLength(2);
    expect(m.leads).toBe(3);
    expect(summariseWeeks(rows, "2026-10")[1]).toMatchObject({ leads: 3, sold: 2 });
  });

  it("uses Dubai time for lead dates", () => {
    // 22:00 UTC on 30 Sep is 02:00 on 1 Oct in Dubai.
    const m = summariseMonth([sale({ created_at: "2026-09-30T22:00:00Z" })], "2026-10");
    expect(m.leads).toBe(1);
  });
});

describe("monthsEnding", () => {
  it("lists twelve months ending with the given one, across a year boundary", () => {
    const months = monthsEnding("2026-03", 12);
    expect(months[0]).toBe("2025-04");
    expect(months.at(-1)).toBe("2026-03");
    expect(months).toHaveLength(12);
  });
});
