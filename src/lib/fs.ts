import { get, set } from "idb-keyval";
import { extractTags, matchQuery, type Searchable } from "./search";

const RECENT_FOLDERS_KEY = "recent-folders-handle";

export interface FileNode {
  name: string;
  kind: "file" | "directory";
  handle: FileSystemHandle;
  children?: FileNode[];
  relativePath: string;
  parentHandle?: FileSystemDirectoryHandle;
  // biome-ignore lint/suspicious/noExplicitAny: icon is a hugeicons component
  icon?: any;
}

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"];

export async function getFileTree(
  dirHandle: FileSystemDirectoryHandle,
  relativePath = "",
  showHiddenFiles = false,
): Promise<FileNode[]> {
  const nodes: FileNode[] = [];
  // @ts-expect-error - FileSystemDirectoryHandle has values() but it might not be in the default types yet
  for await (const entry of dirHandle.values()) {
    if (!showHiddenFiles && entry.name.startsWith(".")) {
      continue;
    }
    const entryRelativePath = relativePath
      ? `${relativePath}/${entry.name}`
      : entry.name;
    if (entry.kind === "directory") {
      const children = await getFileTree(
        entry as FileSystemDirectoryHandle,
        entryRelativePath,
        showHiddenFiles,
      );
      nodes.push({
        name: entry.name,
        kind: "directory",
        handle: entry,
        relativePath: entryRelativePath,
        children,
        parentHandle: dirHandle,
      });
    } else if (
      entry.name.endsWith(".md") ||
      IMAGE_EXTENSIONS.some((ext) => entry.name.toLowerCase().endsWith(ext))
    ) {
      nodes.push({
        name: entry.name,
        kind: "file",
        handle: entry,
        relativePath: entryRelativePath,
        parentHandle: dirHandle,
      });
    }
  }
  // Sort: directories first, then files, both alphabetically
  return nodes.sort((a, b) => {
    if (a.kind === b.kind) {
      return a.name.localeCompare(b.name);
    }
    return a.kind === "directory" ? -1 : 1;
  });
}

export async function readFile(
  fileHandle: FileSystemFileHandle,
): Promise<{ content: string; lastModified: number }> {
  const file = await fileHandle.getFile();
  const content = await file.text();
  return { content, lastModified: file.lastModified };
}

export async function writeFile(
  fileHandle: FileSystemFileHandle,
  content: string,
): Promise<number> {
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
  const file = await fileHandle.getFile();
  return file.lastModified;
}

export async function saveRecentFolders(handles: FileSystemDirectoryHandle[]) {
  await set(RECENT_FOLDERS_KEY, handles);
}

export async function getRecentFolders(): Promise<
  FileSystemDirectoryHandle[] | null
> {
  const handles = await get<FileSystemDirectoryHandle[]>(RECENT_FOLDERS_KEY);
  if (!handles) return null;

  // Verify permission
  const results = await Promise.all(
    handles.map(async (handle) => {
      const [perm, readPerm] = await Promise.all([
        // @ts-expect-error
        handle.queryPermission({ mode: "readwrite" }),
        // @ts-expect-error
        handle.queryPermission({ mode: "read" }),
      ]);
      return {
        handle,
        granted: perm === "granted" || readPerm === "granted",
      };
    }),
  );

  const filteredHandles = results
    .filter((r) => r.granted)
    .map((r) => r.handle);

  return filteredHandles.length > 0 ? filteredHandles : null;
}

export async function getStoredHandle(): Promise<FileSystemDirectoryHandle | null> {
  const handles = await get<FileSystemDirectoryHandle[]>(RECENT_FOLDERS_KEY);
  return handles?.[0] ?? null;
}

export async function searchFiles(
  dirHandle: FileSystemDirectoryHandle,
  query: string,
  relativePath = "",
): Promise<{ node: FileNode; snippet: string }[]> {
  const results: { node: FileNode; snippet: string }[] = [];

  // @ts-expect-error
  for await (const entry of dirHandle.values()) {
    const entryRelativePath = relativePath
      ? `${relativePath}/${entry.name}`
      : entry.name;

    if (entry.kind === "directory") {
      const subResults = await searchFiles(
        entry as FileSystemDirectoryHandle,
        query,
        entryRelativePath,
      );
      results.push(...subResults);
    } else if (entry.name.endsWith(".md")) {
      const file = await (entry as FileSystemFileHandle).getFile();
      const content = await file.text();

      const searchable: Searchable = {
        label: entry.name,
        path: entryRelativePath,
        content,
        tags: extractTags(content),
      };

      if (matchQuery(query, searchable)) {
        // Snippet logic: try to find a relevant content match
        // We'll use a simple heuristic: find the first non-operator term that matches in content
        const terms = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        let matchingTerm = "";
        for (const term of terms) {
          if (
            !term.includes(":") &&
            !term.startsWith("-") &&
            !term.startsWith("/")
          ) {
            if (content.toLowerCase().includes(term.toLowerCase())) {
              matchingTerm = term;
              break;
            }
          }
        }

        const lowerContent = content.toLowerCase();
        const lowerTerm = matchingTerm.toLowerCase() || query.toLowerCase();
        const index = lowerContent.includes(lowerTerm)
          ? lowerContent.indexOf(lowerTerm)
          : 0;

        const start = Math.max(0, index - 40);
        const end = Math.min(content.length, index + lowerTerm.length + 40);
        let snippet = content.substring(start, end);
        if (start > 0) snippet = `...${snippet}`;
        if (end < content.length) snippet = `${snippet}...`;

        results.push({
          node: {
            name: entry.name,
            kind: "file",
            handle: entry,
            relativePath: entryRelativePath,
            parentHandle: dirHandle,
          },
          snippet,
        });
      }
    }
  }
  return results;
}

export async function requestPermission(
  handle: FileSystemHandle,
): Promise<boolean> {
  try {
    // @ts-expect-error
    const readwrite = await handle.requestPermission({ mode: "readwrite" });
    if (readwrite === "granted") return true;
  } catch {}

  try {
    // @ts-expect-error
    const read = await handle.requestPermission({ mode: "read" });
    return read === "granted";
  } catch {
    return false;
  }
}

export async function getFileHandleByPath(
  dirHandle: FileSystemDirectoryHandle,
  path: string,
): Promise<FileSystemFileHandle | null> {
  const parts = path.split("/").filter((p) => p !== "." && p !== "");
  let currentDir = dirHandle;

  try {
    for (let i = 0; i < parts.length - 1; i++) {
      currentDir = await currentDir.getDirectoryHandle(parts[i]);
    }
    return await currentDir.getFileHandle(parts[parts.length - 1]);
  } catch (err) {
    console.error(`Failed to get file handle for path: ${path}`, err);
    return null;
  }
}
