import { describe, expect, it } from "vitest";
import { isImageInternalLinkTarget } from "./internal-links";

describe("isImageInternalLinkTarget", () => {
  it("should return true for valid image extensions", () => {
    expect(isImageInternalLinkTarget("image.png")).toBe(true);
    expect(isImageInternalLinkTarget("photo.jpg")).toBe(true);
    expect(isImageInternalLinkTarget("picture.jpeg")).toBe(true);
    expect(isImageInternalLinkTarget("animation.gif")).toBe(true);
    expect(isImageInternalLinkTarget("graphic.webp")).toBe(true);
    expect(isImageInternalLinkTarget("vector.svg")).toBe(true);
    expect(isImageInternalLinkTarget("modern.avif")).toBe(true);
  });

  it("should be case-insensitive", () => {
    expect(isImageInternalLinkTarget("image.PNG")).toBe(true);
    expect(isImageInternalLinkTarget("photo.JPG")).toBe(true);
    expect(isImageInternalLinkTarget("picture.Jpeg")).toBe(true);
  });

  it("should handle targets with hashes", () => {
    expect(isImageInternalLinkTarget("image.png#anchor")).toBe(true);
    expect(isImageInternalLinkTarget("photo.jpg#section1")).toBe(true);
  });

  it("should handle targets with query parameters", () => {
    expect(isImageInternalLinkTarget("image.png?v=1")).toBe(true);
    expect(isImageInternalLinkTarget("photo.jpg?width=100&height=200")).toBe(true);
  });

  it("should handle targets with both query parameters and hashes", () => {
    expect(isImageInternalLinkTarget("image.png?v=1#anchor")).toBe(true);
  });

  it("should return false for targets without extensions", () => {
    expect(isImageInternalLinkTarget("my-note")).toBe(false);
    expect(isImageInternalLinkTarget("archive#section")).toBe(false);
    expect(isImageInternalLinkTarget("folder/file")).toBe(false);
  });

  it("should return false for non-image extensions", () => {
    expect(isImageInternalLinkTarget("document.md")).toBe(false);
    expect(isImageInternalLinkTarget("style.css")).toBe(false);
    expect(isImageInternalLinkTarget("script.js")).toBe(false);
    expect(isImageInternalLinkTarget("archive.zip")).toBe(false);
  });

  it("should return false for empty or malformed targets", () => {
    expect(isImageInternalLinkTarget("")).toBe(false);
    expect(isImageInternalLinkTarget("#anchor")).toBe(false);
    expect(isImageInternalLinkTarget("?query=1")).toBe(false);
    expect(isImageInternalLinkTarget(".png")).toBe(true); // Technically matches regex .png
  });
});
