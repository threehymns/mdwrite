export interface Frontmatter {
  tags?: string[];
  title?: string;
  date?: string;
  [key: string]: unknown;
}

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n?---\s*(\n|$)/;

export function parseFrontmatter(content: string): {
  frontmatter: Frontmatter;
  body: string;
  hasFrontmatter: boolean;
} {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: {}, body: content, hasFrontmatter: false };
  }

  const yamlStr = match[1];
  const body = content.slice(match[0].length);
  const frontmatter: Frontmatter = {};

  for (const line of yamlStr.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) {
      if (line.trim().startsWith("- ")) {
        const tagValue = line.trim().slice(2).replace(/['"]/g, "");
        if (frontmatter.tags) {
          frontmatter.tags.push(tagValue);
        } else {
          frontmatter.tags = [tagValue];
        }
      }
      continue;
    }
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();

    if (!key) continue;

    if (key === "tags") {
      if (value.startsWith("[")) {
        frontmatter.tags = value
          .slice(1, -1)
          .split(",")
          .map((t) => t.trim().replace(/['"]/g, ""));
      } else if (value) {
        frontmatter.tags = [value.replace(/['"]/g, "")];
      } else {
        frontmatter.tags = [];
      }
    } else if (value === "true") {
      frontmatter[key] = true;
    } else if (value === "false") {
      frontmatter[key] = false;
    } else if (/^\d+$/.test(value)) {
      frontmatter[key] = parseInt(value, 10);
    } else if (/^[\d.]+$/.test(value)) {
      frontmatter[key] = parseFloat(value);
    } else if (value === "[]") {
      frontmatter[key] = [];
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      frontmatter[key] = value;
    } else {
      frontmatter[key] = value.replace(/^['"]|['"]$/g, "");
    }
  }

  return { frontmatter, body, hasFrontmatter: true };
}

export function serializeFrontmatter(frontmatter: Frontmatter): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map((v) => `'${v}'`).join(", ")}]`);
    } else if (typeof value === "boolean") {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === "number") {
      lines.push(`${key}: ${value}`);
    } else {
      lines.push(`${key}: '${value}'`);
    }
  }
  return lines.length > 0 ? `---\n${lines.join("\n")}\n---\n` : "";
}
