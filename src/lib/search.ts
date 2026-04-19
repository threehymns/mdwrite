import { parseFrontmatter } from "./markdown";

export interface Searchable {
  label: string;
  path?: string;
  content?: string;
  tags: string[];
}

export const TAG_RE = /(?:^|\s)#([a-zA-Z0-9_\-/]+)/g;

export function extractTags(content: string): string[] {
  const { frontmatter, body } = parseFrontmatter(content);
  const tags = new Set<string>(frontmatter.tags || []);

  TAG_RE.lastIndex = 0;
  let match = TAG_RE.exec(body);
  while (match !== null) {
    tags.add(match[1]);
    match = TAG_RE.exec(body);
  }
  return Array.from(tags);
}

export function matchQuery(query: string, item: Searchable): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  // Split by OR
  const orParts = trimmed.split(/\s+OR\s+/i);
  if (orParts.length > 1) {
    return orParts.some((part) => matchQuery(part, item));
  }

  // Split by space (AND logic for everything else)
  const andParts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  if (andParts.length > 1) {
    return andParts.every((part) => matchQuery(part, item));
  }

  let term = trimmed;
  const isNegated = term.startsWith("-");
  if (isNegated) term = term.slice(1);

  let matches = false;
  if (term.startsWith("/") && term.endsWith("/")) {
    try {
      const regex = new RegExp(term.slice(1, -1), "i");
      matches =
        regex.test(item.label) ||
        (item.path ? regex.test(item.path) : false) ||
        (item.content ? regex.test(item.content) : false);
    } catch (_e) {
      matches = false;
    }
  } else if (term.startsWith("path:")) {
    const val = term.slice(5).toLowerCase().replace(/"/g, "");
    matches = (item.path || "").toLowerCase().includes(val);
  } else if (term.startsWith("file:")) {
    const val = term.slice(5).toLowerCase().replace(/"/g, "");
    matches = item.label.toLowerCase().includes(val);
  } else if (term.startsWith("tag:")) {
    const val = term.slice(4).toLowerCase().replace(/"/g, "").replace(/^#/, "");
    matches = item.tags.some((t) => t.toLowerCase() === val);
  } else if (term.startsWith("content:")) {
    const val = term.slice(8).toLowerCase().replace(/"/g, "");
    matches = (item.content || "").toLowerCase().includes(val);
  } else if (term.startsWith("label:")) {
    const val = term.slice(6).toLowerCase().replace(/"/g, "");
    matches = item.label.toLowerCase().includes(val);
  } else {
    const val = term.toLowerCase().replace(/"/g, "");
    matches =
      item.label.toLowerCase().includes(val) ||
      (item.path || "").toLowerCase().includes(val) ||
      (item.content || "").toLowerCase().includes(val) ||
      item.tags.some((t) => t.toLowerCase().includes(val));
  }

  return isNegated ? !matches : matches;
}
