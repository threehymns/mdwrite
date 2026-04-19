import { describe, it, expect } from "vitest";
import { matchQuery, extractTags, Searchable } from "./search";

describe("extractTags", () => {
  it("extracts tags from frontmatter", () => {
    const content = "---\ntags: [tag1, tag2]\n---\nBody content";
    const tags = extractTags(content);
    expect(tags).toContain("tag1");
    expect(tags).toContain("tag2");
  });

  it("extracts tags from body", () => {
    const content = "Body content with #tag1 and #tag2/subtag";
    const tags = extractTags(content);
    expect(tags).toContain("tag1");
    expect(tags).toContain("tag2/subtag");
  });

  it("extracts tags from both frontmatter and body", () => {
    const content = "---\ntags: [tag1]\n---\nBody with #tag2";
    const tags = extractTags(content);
    expect(tags).toContain("tag1");
    expect(tags).toContain("tag2");
    expect(tags.length).toBe(2);
  });

  it("handles duplicate tags", () => {
    const content = "---\ntags: [tag1]\n---\nBody with #tag1";
    const tags = extractTags(content);
    expect(tags).toEqual(["tag1"]);
  });

  it("handles no tags", () => {
    const content = "Body with no tags";
    expect(extractTags(content)).toEqual([]);
  });
});

describe("matchQuery", () => {
  const item: Searchable = {
    label: "My Note",
    path: "/notes/my-note.md",
    content: "This is a note about cats and dogs.",
    tags: ["animals", "pets"],
  };

  describe("basic matching", () => {
    it("matches label", () => {
      expect(matchQuery("note", item)).toBe(true);
      expect(matchQuery("My", item)).toBe(true);
    });

    it("matches path", () => {
      expect(matchQuery("/notes/", item)).toBe(true);
      expect(matchQuery("my-note", item)).toBe(true);
    });

    it("matches content", () => {
      expect(matchQuery("cats", item)).toBe(true);
      expect(matchQuery("dogs", item)).toBe(true);
    });

    it("matches tags", () => {
      expect(matchQuery("animals", item)).toBe(true);
      expect(matchQuery("pets", item)).toBe(true);
    });

    it("is case-insensitive", () => {
      expect(matchQuery("MY NOTE", item)).toBe(true);
      expect(matchQuery("CATS", item)).toBe(true);
    });

    it("returns true for empty query", () => {
      expect(matchQuery("", item)).toBe(true);
      expect(matchQuery("   ", item)).toBe(true);
    });

    it("returns false for no match", () => {
      expect(matchQuery("birds", item)).toBe(false);
    });
  });

  describe("logical operators", () => {
    it("handles OR logic", () => {
      expect(matchQuery("cats OR birds", item)).toBe(true);
      expect(matchQuery("birds OR cats", item)).toBe(true);
      expect(matchQuery("birds OR fish", item)).toBe(false);
    });

    it("handles AND logic (space separated)", () => {
      expect(matchQuery("cats dogs", item)).toBe(true);
      expect(matchQuery("cats birds", item)).toBe(false);
    });

    it("handles negation", () => {
      expect(matchQuery("-birds", item)).toBe(true);
      expect(matchQuery("-cats", item)).toBe(false);
    });

    it("combines AND and negation", () => {
      expect(matchQuery("cats -birds", item)).toBe(true);
      expect(matchQuery("cats -dogs", item)).toBe(false);
    });
  });

  describe("prefixes", () => {
    it("handles path: prefix", () => {
      expect(matchQuery("path:/notes/", item)).toBe(true);
      expect(matchQuery("path:other", item)).toBe(false);
    });

    it("handles file: prefix (matches label)", () => {
      expect(matchQuery("file:Note", item)).toBe(true);
      expect(matchQuery("file:other", item)).toBe(false);
    });

    it("handles tag: prefix", () => {
      expect(matchQuery("tag:animals", item)).toBe(true);
      expect(matchQuery("tag:#animals", item)).toBe(true);
      expect(matchQuery("tag:pets", item)).toBe(true);
      expect(matchQuery("tag:other", item)).toBe(false);
    });

    it("handles content: prefix", () => {
      expect(matchQuery("content:cats", item)).toBe(true);
      expect(matchQuery("content:My", item)).toBe(false);
    });

    it("handles label: prefix", () => {
      expect(matchQuery("label:Note", item)).toBe(true);
      expect(matchQuery("label:cats", item)).toBe(false);
    });
  });

  describe("quoted terms", () => {
    it("handles quoted terms with spaces", () => {
      const itemWithSpace = { ...item, content: "hello world" };
      expect(matchQuery('"hello world"', itemWithSpace)).toBe(true);
      expect(matchQuery('"hello fish"', itemWithSpace)).toBe(false);
    });
  });

  describe("regex matching", () => {
    it("handles regex patterns", () => {
      expect(matchQuery("/c.ts/", item)).toBe(true);
      expect(matchQuery("/^My/", item)).toBe(true);
      expect(matchQuery("/birds/", item)).toBe(false);
    });

    it("handles invalid regex gracefully", () => {
      expect(matchQuery("/[/", item)).toBe(false);
    });
  });
});
