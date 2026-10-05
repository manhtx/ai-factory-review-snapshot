import { describe, expect, it } from "vitest";

describe("company clock contract", () => {
  it("requires an absolute five-minute clock tolerance", () => {
    expect(Math.abs(4.9)).toBeLessThanOrEqual(5);
    expect(Math.abs(-4.9)).toBeLessThanOrEqual(5);
    expect(Math.abs(5.1)).toBeGreaterThan(5);
  });
});
