import { describe, it, expect } from "vitest";
import { calcGst } from "./gst";

describe("calcGst", () => {
  it("computes subtotal/total for IGST 18% on 1000", () => {
    const r = calcGst(1000, 18, "IGST");
    expect(r.subtotal).toBe(1000);
    expect(r.gstAmount).toBe(180);
    expect(r.total).toBe(1180);
    expect(r.components).toEqual([{ label: "IGST", rate: 18, amount: 180 }]);
  });

  it("splits CGST + SGST half/half for intra-state", () => {
    const r = calcGst(1000, 18, "CGST_SGST");
    expect(r.gstAmount).toBe(180);
    expect(r.components).toHaveLength(2);
    expect(r.components[0]).toEqual({ label: "CGST", rate: 9, amount: 90 });
    expect(r.components[1]).toEqual({ label: "SGST", rate: 9, amount: 90 });
  });

  it("splits CGST + UTGST half/half for union territory", () => {
    const r = calcGst(2000, 12, "CGST_UTGST");
    expect(r.gstAmount).toBe(240);
    expect(r.components.map((c) => c.label)).toEqual(["CGST", "UTGST"]);
    expect(r.components.every((c) => c.amount === 120 && c.rate === 6)).toBe(true);
  });

  it("handles 5% rate", () => {
    const r = calcGst(500, 5, "CGST_SGST");
    expect(r.gstAmount).toBe(25);
    expect(r.total).toBe(525);
    expect(r.components[0].rate).toBe(2.5);
  });

  it("handles zero subtotal", () => {
    const r = calcGst(0, 18, "IGST");
    expect(r.gstAmount).toBe(0);
    expect(r.total).toBe(0);
  });

  it("split components always sum to gstAmount", () => {
    for (const sub of [100, 333.33, 9999.99]) {
      for (const rate of [5, 12, 18] as const) {
        for (const type of ["CGST_SGST", "CGST_UTGST", "IGST"] as const) {
          const r = calcGst(sub, rate, type);
          const sum = r.components.reduce((s, c) => s + c.amount, 0);
          expect(sum).toBeCloseTo(r.gstAmount, 8);
        }
      }
    }
  });
});
