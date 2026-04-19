import { describe, it, expect } from "vitest";
import { matchQuery, type Searchable } from "./search";

describe("matchQuery", () => {
  const item: Searchable = {
    label: "My Note",
    path: "folder/note.md",
    content: "This is a test content with some words.",
    tags: ["work", "important"],
  };

  it("returns true for empty or whitespace-only queries", () => {
    expect(matchQuery("", item)).toBe(true);
    expect(matchQuery("   ", item)).toBe(true);
  });

  describe("basic matching", () => {
    it("matches label", () => {
      expect(matchQuery("Note", item)).toBe(true);
      expect(matchQuery("note", item)).toBe(true); // case-insensitive
    });

    it("matches path", () => {
      expect(matchQuery("folder", item)).toBe(true);
    });

    it("matches content", () => {
      expect(matchQuery("content", item)).toBe(true);
    });

    it("matches tags", () => {
      expect(matchQuery("work", item)).toBe(true);
      expect(matchQuery("important", item)).toBe(true);
    });

    it("returns false when no match is found", () => {
      expect(matchQuery("nonexistent", item)).toBe(false);
    });
  });

  describe("AND logic (spaces)", () => {
    it("matches when all parts match", () => {
      expect(matchQuery("Note folder work", item)).toBe(true);
    });

    it("returns false if any part does not match", () => {
      expect(matchQuery("Note nonexistent", item)).toBe(false);
    });
  });

  describe("OR logic", () => {
    it("matches if any part matches", () => {
      expect(matchQuery("nonexistent OR Note", item)).toBe(true);
      expect(matchQuery("work OR nonexistent", item)).toBe(true);
    });

    it("is case-insensitive for OR keyword", () => {
      expect(matchQuery("nonexistent or Note", item)).toBe(true);
    });

    it("returns false if no parts match", () => {
      expect(matchQuery("nonexistent OR really-not-there", item)).toBe(false);
    });
  });

  describe("negation (-)", () => {
    it("returns false if the term matches but is negated", () => {
      expect(matchQuery("-Note", item)).toBe(false);
    });

    it("returns true if the term does not match and is negated", () => {
      expect(matchQuery("-nonexistent", item)).toBe(true);
    });
  });

  describe("quoted terms", () => {
    it("matches exact phrases with spaces", () => {
      expect(matchQuery('"test content"', item)).toBe(true);
      expect(matchQuery('"test missing"', item)).toBe(false);
    });
  });

  describe("regex matching", () => {
    it("matches using regex", () => {
      expect(matchQuery("/n.te/", item)).toBe(true);
      expect(matchQuery("/^folder/", item)).toBe(true);
    });

    it("handles invalid regex gracefully", () => {
      expect(matchQuery("/[/", item)).toBe(false);
    });
  });

  describe("prefixed searches", () => {
    it("matches path: prefix", () => {
      expect(matchQuery("path:folder", item)).toBe(true);
      expect(matchQuery("path:note", item)).toBe(true);
      expect(matchQuery("path:work", item)).toBe(false);
    });

    it("matches file: prefix", () => {
      expect(matchQuery("file:Note", item)).toBe(true);
      expect(matchQuery("file:folder", item)).toBe(false);
    });

    it("matches tag: prefix", () => {
      expect(matchQuery("tag:work", item)).toBe(true);
      expect(matchQuery("tag:#work", item)).toBe(true);
      expect(matchQuery("tag:important", item)).toBe(true);
      expect(matchQuery("tag:wor", item)).toBe(false); // Exact match for tags
    });

    it("matches content: prefix", () => {
      expect(matchQuery("content:test", item)).toBe(true);
      expect(matchQuery("content:Note", item)).toBe(false);
    });
  });

  describe("combinations and edge cases", () => {
    it("handles complex logic", () => {
      // (Note AND work) AND (NOT nonexistent)
      expect(matchQuery("Note work -nonexistent", item)).toBe(true);
      // (nonexistent) OR (Note AND -work) -> false OR false -> false
      expect(matchQuery("nonexistent OR (Note -work)", item)).toBe(false);
      // wait, matchQuery doesn't support parentheses explicitly, but it splits by OR first, then AND.
      // "nonexistent OR Note -work" -> (nonexistent) OR (Note AND -work)
      expect(matchQuery("nonexistent OR Note -work", item)).toBe(false);
    });

    it("handles missing optional fields", () => {
      const minimalItem: Searchable = {
        label: "Minimal",
        tags: [],
      };
      expect(matchQuery("Minimal", minimalItem)).toBe(true);
      expect(matchQuery("path:anything", minimalItem)).toBe(false);
      expect(matchQuery("content:anything", minimalItem)).toBe(false);
      expect(matchQuery("/regex/", minimalItem)).toBe(false);
    });
  });
});
