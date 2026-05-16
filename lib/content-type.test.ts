import { describe, it, expect } from "vitest";
import { CONTENT_TYPES } from "./genres";

describe("CONTENT_TYPES", () => {
  it("includes fiction and cartoon", () => {
    expect(CONTENT_TYPES).toContain("fiction");
    expect(CONTENT_TYPES).toContain("cartoon");
  });

  it("defaults to fiction (first entry)", () => {
    expect(CONTENT_TYPES[0]).toBe("fiction");
  });

  it("rejects invalid content types", () => {
    const invalid = "manga";
    expect((CONTENT_TYPES as readonly string[]).includes(invalid)).toBe(false);
  });

  it("accepts valid cartoon content type", () => {
    expect((CONTENT_TYPES as readonly string[]).includes("cartoon")).toBe(true);
  });
});
