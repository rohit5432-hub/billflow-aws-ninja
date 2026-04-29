import type { GstType } from "./store";

export type GstBreakdown = {
  subtotal: number;
  gstAmount: number;
  total: number;
  /** Each component line, e.g. CGST 9%, SGST 9% or IGST 18%. */
  components: { label: string; rate: number; amount: number }[];
};

/**
 * Pure GST calculator. Splits the GST amount according to type:
 * - CGST_SGST / CGST_UTGST: half/half between two components
 * - IGST: full amount as a single component
 */
export function calcGst(
  subtotal: number,
  gstRate: number,
  gstType: GstType
): GstBreakdown {
  const gstAmount = (subtotal * gstRate) / 100;
  const total = subtotal + gstAmount;
  const half = gstAmount / 2;
  const halfRate = gstRate / 2;

  let components: GstBreakdown["components"];
  if (gstType === "IGST") {
    components = [{ label: "IGST", rate: gstRate, amount: gstAmount }];
  } else if (gstType === "CGST_UTGST") {
    components = [
      { label: "CGST", rate: halfRate, amount: half },
      { label: "UTGST", rate: halfRate, amount: half },
    ];
  } else {
    components = [
      { label: "CGST", rate: halfRate, amount: half },
      { label: "SGST", rate: halfRate, amount: half },
    ];
  }

  return { subtotal, gstAmount, total, components };
}
