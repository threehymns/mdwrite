import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Preferences } from "@capacitor/preferences";
import type {
	FileNode,
	FileSystemProvider,
	ReadFileResult,
} from "./fs-provider";
import { extractTags, matchQuery, type Searchable } from "./search";

const RECENT_FOLDER_KEY = "recent-folder-path";
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"];

async function pathExists(
	path: string,
	directory: Directory = Directory.Documents,
): Promise<boolean> {
	try {
		await Filesystem.stat({ path, directory });
		return true;
	} catch {
		return false;
	}
}

function joinPath(...parts: string[]): string {
	return parts.filter(Boolean).join("/").replace(/\/+/g, "/");
}

export class CapacitorFileSystemProvider implements FileSystemProvider {
	readonly name = "capacitor";

	async pickDirectory(): Promise<{ handle: unknown; name: string } | null> {
		const defaultPath = "MDWrite";

		if (!(await pathExists(defaultPath, Directory.Documents))) {
			try {
				await Filesystem.mkdir({
					path: defaultPath,
					directory: Directory.Documents,
					recursive: true,
				});
			} catch (err) {
				console.error("Failed to create default directory", err);
				return null;
			}
		}

		return { handle: defaultPath, name: defaultPath };
	}

	async getFileTree(
		dirHandle: unknown,
		relativePath = "",
		showHiddenFiles = false,
	): Promise<FileNode[]> {
		const basePath = dirHandle as string;
		const fullPath = relativePath ? joinPath(basePath, relativePath) : basePath;
		const nodes: FileNode[] = [];

		try {
			const result = await Filesystem.readdir({
				path: fullPath,
				directory: Directory.Documents,
			});

			for (const entry of result.files) {
				if (!showHiddenFiles && entry.name.startsWith(".")) {
					continue;
				}

				const entryRelativePath = relativePath
					? `${relativePath}/${entry.name}`
					: entry.name;

				if (entry.type === "directory") {
					const children = await this.getFileTree(
						basePath,
						entryRelativePath,
						showHiddenFiles,
					);
					nodes.push({
						name: entry.name,
						kind: "directory",
						handle: basePath,
						relativePath: entryRelativePath,
						children,
						parentHandle: basePath,
					});
				} else if (
					entry.name.endsWith(".md") ||
					IMAGE_EXTENSIONS.some((ext) => entry.name.toLowerCase().endsWith(ext))
				) {
					nodes.push({
						name: entry.name,
						kind: "file",
						handle: basePath,
						relativePath: entryRelativePath,
						parentHandle: basePath,
					});
				}
			}
		} catch (err) {
			console.error(`Failed to read directory: ${fullPath}`, err);
		}

		return nodes.sort((a, b) => {
			if (a.kind === b.kind) {
				return a.name.localeCompare(b.name);
			}
			return a.kind === "directory" ? -1 : 1;
		});
	}

	async readFile(fileHandle: unknown): Promise<ReadFileResult> {
		const path = fileHandle as string;
		try {
			const result = await Filesystem.readFile({
				path,
				directory: Directory.Documents,
				encoding: Encoding.UTF8,
			});

			const stat = await Filesystem.stat({
				path,
				directory: Directory.Documents,
			});

			return {
				content: result.data as string,
				lastModified: stat.mtime,
			};
		} catch (err) {
			console.error(`Failed to read file: ${path}`, err);
			throw err;
		}
	}

	async writeFile(fileHandle: unknown, content: string): Promise<number> {
		const path = fileHandle as string;
		await Filesystem.writeFile({
			path,
			data: content,
			directory: Directory.Documents,
			encoding: Encoding.UTF8,
		});

		const stat = await Filesystem.stat({
			path,
			directory: Directory.Documents,
		});

		return stat.mtime;
	}

	async searchFiles(
		dirHandle: unknown,
		query: string,
		relativePath = "",
	): Promise<{ node: FileNode; snippet: string }[]> {
		const basePath = dirHandle as string;
		const fullPath = relativePath ? joinPath(basePath, relativePath) : basePath;
		const results: { node: FileNode; snippet: string }[] = [];

		try {
			const dirResult = await Filesystem.readdir({
				path: fullPath,
				directory: Directory.Documents,
			});

			for (const entry of dirResult.files) {
				const entryRelativePath = relativePath
					? `${relativePath}/${entry.name}`
					: entry.name;

				if (entry.type === "directory") {
					const subResults = await this.searchFiles(
						basePath,
						query,
						entryRelativePath,
					);
					results.push(...subResults);
				} else if (entry.name.endsWith(".md")) {
					const filePath = joinPath(basePath, entryRelativePath);
					try {
						const fileResult = await Filesystem.readFile({
							path: filePath,
							directory: Directory.Documents,
							encoding: Encoding.UTF8,
						});
						const content = fileResult.data as string;

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
							const lowerTerm =
								matchingTerm.toLowerCase() || query.toLowerCase();
							const index = lowerContent.includes(lowerTerm)
								? lowerContent.indexOf(lowerTerm)
								: 0;

							const start = Math.max(0, index - 40);
							const end = Math.min(
								content.length,
								index + lowerTerm.length + 40,
							);
							let snippet = content.substring(start, end);
							if (start > 0) snippet = `...${snippet}`;
							if (end < content.length) snippet = `${snippet}...`;

							results.push({
								node: {
									name: entry.name,
									kind: "file",
									handle: basePath,
									relativePath: entryRelativePath,
									parentHandle: basePath,
								},
								snippet,
							});
						}
					} catch (err) {
						console.error(`Failed to read file for search: ${filePath}`, err);
					}
				}
			}
		} catch (err) {
			console.error(`Failed to search directory: ${fullPath}`, err);
		}

		return results;
	}

	async saveRecentFolder(handle: unknown): Promise<void> {
		await Preferences.set({
			key: RECENT_FOLDER_KEY,
			value: handle as string,
		});
	}

	async getRecentFolder(): Promise<unknown | null> {
		const { value } = await Preferences.get({ key: RECENT_FOLDER_KEY });
		if (!value) return null;

		if (await pathExists(value, Directory.Documents)) {
			return value;
		}

		return null;
	}

	async getStoredHandle(): Promise<unknown | null> {
		return this.getRecentFolder();
	}

	async requestPermission(_handle: unknown): Promise<boolean> {
		return true;
	}

	async getFileHandleByPath(
		dirHandle: unknown,
		path: string,
	): Promise<unknown | null> {
		const basePath = dirHandle as string;
		const fullPath = joinPath(basePath, path);

		if (await pathExists(fullPath, Directory.Documents)) {
			return fullPath;
		}

		return null;
	}

	async deleteEntry(parentHandle: unknown, name: string): Promise<void> {
		const basePath = parentHandle as string;
		const fullPath = joinPath(basePath, name);

		try {
			const stat = await Filesystem.stat({
				path: fullPath,
				directory: Directory.Documents,
			});

			if (stat.type === "directory") {
				await Filesystem.rmdir({
					path: fullPath,
					directory: Directory.Documents,
					recursive: true,
				});
			} else {
				await Filesystem.deleteFile({
					path: fullPath,
					directory: Directory.Documents,
				});
			}
		} catch (err) {
			console.error(`Failed to delete: ${fullPath}`, err);
			throw err;
		}
	}

	async createFile(parentHandle: unknown, fileName: string): Promise<unknown> {
		const basePath = parentHandle as string;
		const filePath = joinPath(basePath, fileName);

		await Filesystem.writeFile({
			path: filePath,
			data: "",
			directory: Directory.Documents,
			encoding: Encoding.UTF8,
		});

		return filePath;
	}

	async createDirectory(
		parentHandle: unknown,
		dirName: string,
	): Promise<unknown> {
		const basePath = parentHandle as string;
		const dirPath = joinPath(basePath, dirName);

		await Filesystem.mkdir({
			path: dirPath,
			directory: Directory.Documents,
			recursive: false,
		});

		return dirPath;
	}

	async renameEntry(node: FileNode, newName: string): Promise<void> {
		const basePath = node.handle as string;
		const oldPath = joinPath(basePath, node.relativePath);
		const parentDir = node.relativePath.includes("/")
			? node.relativePath.slice(0, node.relativePath.lastIndexOf("/"))
			: "";
		const newPath = joinPath(basePath, parentDir, newName);

		await Filesystem.rename({
			from: oldPath,
			to: newPath,
			directory: Directory.Documents,
		});
	}

	async moveEntry(node: FileNode, targetHandle: unknown): Promise<void> {
		const basePath = node.handle as string;
		const oldPath = joinPath(basePath, node.relativePath);
		const targetBase = targetHandle as string;
		const newPath = joinPath(targetBase, node.name);

		await Filesystem.rename({
			from: oldPath,
			to: newPath,
			directory: Directory.Documents,
		});
	}

	async writeFileFromBlob(
		parentHandle: unknown,
		fileName: string,
		blob: Blob,
	): Promise<string> {
		const basePath = parentHandle as string;
		const assetsDir = joinPath(basePath, "assets");

		if (!(await pathExists(assetsDir, Directory.Documents))) {
			await Filesystem.mkdir({
				path: assetsDir,
				directory: Directory.Documents,
				recursive: true,
			});
		}

		const filePath = joinPath(assetsDir, fileName);
		const base64 = await blobToBase64(blob);

		await Filesystem.writeFile({
			path: filePath,
			data: base64,
			directory: Directory.Documents,
		});

		return `./assets/${fileName}`;
	}

	async readFileAsBlob(
		fileHandle: unknown,
	): Promise<{ blob: Blob; lastModified: number }> {
		const path = fileHandle as string;
		const ext = path.split(".").pop()?.toLowerCase() || "";
		const mimeType = getMimeType(ext);

		const stat = await Filesystem.stat({
			path,
			directory: Directory.Documents,
		});

		const result = await Filesystem.readFile({
			path,
			directory: Directory.Documents,
		});

		if (typeof result.data === "string") {
			const binary = atob(result.data);
			const bytes = new Uint8Array(binary.length);
			for (let i = 0; i < binary.length; i++) {
				bytes[i] = binary.charCodeAt(i);
			}
			return {
				blob: new Blob([bytes], { type: mimeType }),
				lastModified: stat.mtime,
			};
		}

		return {
			blob: new Blob([result.data as unknown as ArrayBuffer], {
				type: mimeType,
			}),
			lastModified: stat.mtime,
		};
	}

	async resolveImageUrl(fileHandle: unknown): Promise<string> {
		const path = fileHandle as string;
		const result = await Filesystem.readFile({
			path,
			directory: Directory.Documents,
		});

		const ext = path.split(".").pop()?.toLowerCase() || "";
		const mimeType = getMimeType(ext);

		if (typeof result.data === "string") {
			return `data:${mimeType};base64,${result.data}`;
		}

		const blob = result.data as Blob;
		const buffer = await blob.arrayBuffer();
		const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
		return `data:${mimeType};base64,${base64}`;
	}
}

function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => {
			const result = reader.result as string;
			const base64 = result.split(",")[1];
			resolve(base64);
		};
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
}

function getMimeType(ext: string): string {
	const mimeMap: Record<string, string> = {
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		gif: "image/gif",
		svg: "image/svg+xml",
		webp: "image/webp",
	};
	return mimeMap[ext] || "application/octet-stream";
}
