import { get, set } from "idb-keyval";
import type {
	FileNode,
	FileSystemProvider,
	ReadFileResult,
} from "./fs-provider";
import { extractTags, matchQuery, type Searchable } from "./search";

const RECENT_FOLDER_KEY = "recent-folder-handle";
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"];

export class WebFileSystemProvider implements FileSystemProvider {
	readonly name = "web";

	async pickDirectory(): Promise<{ handle: unknown; name: string } | null> {
		try {
			const handle = await (
				window as unknown as {
					showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
				}
			).showDirectoryPicker();
			return { handle, name: handle.name };
		} catch {
			return null;
		}
	}

	async getFileTree(
		dirHandle: unknown,
		relativePath = "",
		showHiddenFiles = false,
	): Promise<FileNode[]> {
		const handle = dirHandle as FileSystemDirectoryHandle;
		const nodes: FileNode[] = [];
		// @ts-expect-error - FileSystemDirectoryHandle has values()
		for await (const entry of handle.values()) {
			if (!showHiddenFiles && entry.name.startsWith(".")) {
				continue;
			}
			const entryRelativePath = relativePath
				? `${relativePath}/${entry.name}`
				: entry.name;
			if (entry.kind === "directory") {
				const children = await this.getFileTree(
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
					parentHandle: handle,
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
					parentHandle: handle,
				});
			}
		}
		return nodes.sort((a, b) => {
			if (a.kind === b.kind) {
				return a.name.localeCompare(b.name);
			}
			return a.kind === "directory" ? -1 : 1;
		});
	}

	async readFile(fileHandle: unknown): Promise<ReadFileResult> {
		const handle = fileHandle as FileSystemFileHandle;
		const file = await handle.getFile();
		const content = await file.text();
		return { content, lastModified: file.lastModified };
	}

	async writeFile(fileHandle: unknown, content: string): Promise<number> {
		const handle = fileHandle as FileSystemFileHandle;
		const writable = await handle.createWritable();
		await writable.write(content);
		await writable.close();
		const file = await handle.getFile();
		return file.lastModified;
	}

	async searchFiles(
		dirHandle: unknown,
		query: string,
		relativePath = "",
	): Promise<{ node: FileNode; snippet: string }[]> {
		const handle = dirHandle as FileSystemDirectoryHandle;
		const results: { node: FileNode; snippet: string }[] = [];

		// @ts-expect-error
		for await (const entry of handle.values()) {
			const entryRelativePath = relativePath
				? `${relativePath}/${entry.name}`
				: entry.name;

			if (entry.kind === "directory") {
				const subResults = await this.searchFiles(
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
							parentHandle: handle,
						},
						snippet,
					});
				}
			}
		}
		return results;
	}

	async saveRecentFolder(handle: unknown): Promise<void> {
		await set(RECENT_FOLDER_KEY, handle as FileSystemDirectoryHandle);
	}

	async getRecentFolder(): Promise<unknown | null> {
		const handle = await get<FileSystemDirectoryHandle>(RECENT_FOLDER_KEY);
		if (!handle) return null;

		// @ts-expect-error
		if ((await handle.queryPermission({ mode: "readwrite" })) === "granted") {
			return handle;
		}
		return null;
	}

	async getStoredHandle(): Promise<unknown | null> {
		return (await get<FileSystemDirectoryHandle>(RECENT_FOLDER_KEY)) || null;
	}

	async requestPermission(handle: unknown): Promise<boolean> {
		// @ts-expect-error - requestPermission is available on FileSystemHandle in supporting browsers
		const result = await (handle as FileSystemHandle).requestPermission?.({
			mode: "readwrite",
		});
		return result === "granted";
	}

	async getFileHandleByPath(
		dirHandle: unknown,
		path: string,
	): Promise<unknown | null> {
		const root = dirHandle as FileSystemDirectoryHandle;
		const parts = path.split("/").filter((p) => p !== "." && p !== "");
		let currentDir = root;

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

	async deleteEntry(parentHandle: unknown, name: string): Promise<void> {
		await (parentHandle as FileSystemDirectoryHandle).removeEntry(name, {
			recursive: true,
		});
	}

	async createFile(parentHandle: unknown, fileName: string): Promise<unknown> {
		return await (parentHandle as FileSystemDirectoryHandle).getFileHandle(
			fileName,
			{ create: true },
		);
	}

	async createDirectory(
		parentHandle: unknown,
		dirName: string,
	): Promise<unknown> {
		return await (parentHandle as FileSystemDirectoryHandle).getDirectoryHandle(
			dirName,
			{ create: true },
		);
	}

	async renameEntry(node: FileNode, newName: string): Promise<void> {
		const handle = node.handle as FileSystemFileHandle;
		// @ts-expect-error - move() is available in supporting browsers
		if (typeof handle.move === "function") {
			// @ts-expect-error
			await handle.move(newName);
		} else {
			throw new Error("Renaming is not supported in this browser.");
		}
	}

	async moveEntry(node: FileNode, targetHandle: unknown): Promise<void> {
		const handle = node.handle as FileSystemFileHandle;
		// @ts-expect-error - move() is available in supporting browsers
		if (typeof handle.move === "function") {
			// @ts-expect-error
			await handle.move(targetHandle);
		} else {
			throw new Error("Moving is not supported in this browser.");
		}
	}

	async writeFileFromBlob(
		parentHandle: unknown,
		fileName: string,
		blob: Blob,
	): Promise<string> {
		const dirHandle = parentHandle as FileSystemDirectoryHandle;
		const assetsHandle = await dirHandle.getDirectoryHandle("assets", {
			create: true,
		});
		const fileHandle = await assetsHandle.getFileHandle(fileName, {
			create: true,
		});
		const writable = await fileHandle.createWritable();
		await writable.write(blob);
		await writable.close();
		return `./assets/${fileName}`;
	}

	async readFileAsBlob(
		fileHandle: unknown,
	): Promise<{ blob: Blob; lastModified: number }> {
		const handle = fileHandle as FileSystemFileHandle;
		const file = await handle.getFile();
		return { blob: file, lastModified: file.lastModified };
	}

	async resolveImageUrl(fileHandle: unknown): Promise<string> {
		const { blob } = await this.readFileAsBlob(fileHandle);
		return URL.createObjectURL(blob);
	}
}
