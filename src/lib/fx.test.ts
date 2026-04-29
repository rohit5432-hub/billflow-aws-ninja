import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { numberToWordsINR, formatINR, getUsdToInr } from "./fx";

describe("numberToWordsINR", () => {
  it("zero", () => {
    expect(numberToWordsINR(0)).toBe("Zero Rupees Only");
  });

  it("simple rupees", () => {
    expect(numberToWordsINR(1)).toBe("One Rupees Only");
    expect(numberToWordsINR(19)).toBe("Nineteen Rupees Only");
    expect(numberToWordsINR(20)).toBe("Twenty Rupees Only");
    expect(numberToWordsINR(99)).toBe("Ninety Nine Rupees Only");
  });

  it("hundreds and thousands", () => {
    expect(numberToWordsINR(100)).toBe("One Hundred Rupees Only");
    expect(numberToWordsINR(1234)).toBe(
      "One Thousand Two Hundred Thirty Four Rupees Only"
    );
  });

  it("lakh and crore", () => {
    expect(numberToWordsINR(100000)).toBe("One Lakh Rupees Only");
    expect(numberToWordsINR(10000000)).toBe("One Crore Rupees Only");
    expect(numberToWordsINR(12345678)).toContain("Crore");
  });

  it("includes paise", () => {
    expect(numberToWordsINR(1.5)).toBe("One Rupees and Fifty Paise Only");
    expect(numberToWordsINR(0.25)).toBe("Twenty Five Paise Only");
  });
});

describe("formatINR", () => {
  it("formats with INR symbol", () => {
    const out = formatINR(1234.5);
    expect(out).toMatch(/₹/);
    expect(out).toMatch(/1,234/);
  });
});

describe("getUsdToInr", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    // Wipe module-level cache between tests by re-importing? Cache lives in module
    // closure — first test will populate it. Second test will hit cache. So we
    // test the success path then an explicit fallback path with cache reset via
    // dynamic import isolation.
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("returns INR rate from API", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ rates: { INR: 84.2 } }),
    }) as unknown as typeof fetch;
    const rate = await getUsdToInr();
    expect(typeof rate).toBe("number");
    expect(rate).toBeGreaterThan(0);
  });

  it("falls back to 83.5 when fetch throws (uncached fresh import)", async () => {
    vi.resetModules();
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network")) as unknown as typeof fetch;
    const fresh = await import("./fx");
    const rate = await fresh.getUsdToInr();
    expect(rate).toBe(83.5);
  });
});
