import { get, set } from "idb-keyval";

const RECENT_FOLDER_KEY = "recent-folder-handle";

export interface FileNode {
	name: string;
	kind: "file" | "directory";
	handle: FileSystemHandle;
	children?: FileNode[];
	relativePath: string;
	parentHandle?: FileSystemDirectoryHandle;
}

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"];

export async function getFileTree(
	dirHandle: FileSystemDirectoryHandle,
	relativePath = "",
): Promise<FileNode[]> {
	const nodes: FileNode[] = [];
	// @ts-expect-error - FileSystemDirectoryHandle has values() but it might not be in the default types yet
	for await (const entry of dirHandle.values()) {
		const entryRelativePath = relativePath
			? `${relativePath}/${entry.name}`
			: entry.name;
		if (entry.kind === "directory") {
			const children = await getFileTree(
				entry as FileSystemDirectoryHandle,
				entryRelativePath,
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

export async function saveRecentFolder(handle: FileSystemDirectoryHandle) {
	await set(RECENT_FOLDER_KEY, handle);
}

export async function getRecentFolder(): Promise<FileSystemDirectoryHandle | null> {
	const handle = await get<FileSystemDirectoryHandle>(RECENT_FOLDER_KEY);
	if (!handle) return null;

	// Verify permission
	// @ts-expect-error
	if ((await handle.queryPermission({ mode: "readwrite" })) === "granted") {
		return handle;
	}

	return null;
}

export async function getStoredHandle(): Promise<FileSystemDirectoryHandle | null> {
	return (await get<FileSystemDirectoryHandle>(RECENT_FOLDER_KEY)) || null;
}

export async function searchFiles(
	dirHandle: FileSystemDirectoryHandle,
	query: string,
	relativePath = "",
): Promise<{ node: FileNode; snippet: string }[]> {
	const results: { node: FileNode; snippet: string }[] = [];
	const lowerQuery = query.toLowerCase();

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
			const lowerContent = content.toLowerCase();

			if (lowerContent.includes(lowerQuery)) {
				const index = lowerContent.indexOf(lowerQuery);
				const start = Math.max(0, index - 40);
				const end = Math.min(content.length, index + lowerQuery.length + 40);
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
	// @ts-expect-error
	return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
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
