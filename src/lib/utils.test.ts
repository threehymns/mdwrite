import { describe, expect, it } from "vitest";
import { isSafeUrl } from "./utils";

describe("isSafeUrl", () => {
  it("should return true for safe protocols", () => {
    expect(isSafeUrl("https://example.com")).toBe(true);
    expect(isSafeUrl("http://example.com")).toBe(true);
    expect(isSafeUrl("mailto:test@example.com")).toBe(true);
    expect(isSafeUrl("tel:+123456789")).toBe(true);
  });

  it("should return false for dangerous protocols", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("JAVASCRIPT:alert(1)")).toBe(false);
    expect(isSafeUrl(" vbscript:msgbox('hi')")).toBe(false);
    expect(isSafeUrl("data:text/html,<html>")).toBe(false);
  });

  it("should handle empty or null input", () => {
    expect(isSafeUrl("")).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
    expect(isSafeUrl("   ")).toBe(false);
  });

  it("should return true for relative paths", () => {
    expect(isSafeUrl("/path/to/resource")).toBe(true);
    expect(isSafeUrl("./path/to/resource")).toBe(true);
    expect(isSafeUrl("../path/to/resource")).toBe(true);
  });
});
