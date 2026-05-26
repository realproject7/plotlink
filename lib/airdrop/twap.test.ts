import { describe, expect, it } from "vitest";
import { validateTwapSamples } from "./twap";

describe("validateTwapSamples", () => {
  it("rejects 0 samples", () => {
    const result = validateTwapSamples(0, false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("No daily price entries");
  });

  it("rejects 1 sample without override", () => {
    const result = validateTwapSamples(1, false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("requires >=5");
  });

  it("rejects 4 samples without override", () => {
    const result = validateTwapSamples(4, false);
    expect(result.ok).toBe(false);
  });

  it("allows 1 sample with override", () => {
    const result = validateTwapSamples(1, true);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warning).toBeDefined();
  });

  it("allows 5 samples with warning", () => {
    const result = validateTwapSamples(5, false);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warning).toContain("5 samples");
  });

  it("allows 6 samples with warning", () => {
    const result = validateTwapSamples(6, false);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warning).toContain("6 samples");
  });

  it("allows 7 samples cleanly (no warning)", () => {
    const result = validateTwapSamples(7, false);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warning).toBeUndefined();
  });
});
