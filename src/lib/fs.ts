import type { FileSystemProvider } from "./fs-provider";
import { isNative } from "./platform";

export type {
	FileNode,
	FileSystemProvider,
	ReadFileResult,
} from "./fs-provider";
export type { Searchable } from "./search";
export { extractTags, matchQuery } from "./search";

let _provider: FileSystemProvider | null = null;

export async function getFileSystemProvider(): Promise<FileSystemProvider> {
	if (_provider) return _provider;

	if (isNative()) {
		const { CapacitorFileSystemProvider } = await import("./fs-capacitor");
		_provider = new CapacitorFileSystemProvider();
	} else {
		const { WebFileSystemProvider } = await import("./fs-web");
		_provider = new WebFileSystemProvider();
	}

	return _provider;
}

export function getFileSystemProviderSync(): FileSystemProvider {
	if (!_provider) {
		throw new Error(
			"FileSystemProvider not initialized. Call getFileSystemProvider() first.",
		);
	}
	return _provider;
}

export async function getFileTree(
	dirHandle: unknown,
	relativePath = "",
	showHiddenFiles = false,
) {
	const provider = await getFileSystemProvider();
	return provider.getFileTree(dirHandle, relativePath, showHiddenFiles);
}

export async function readFile(fileHandle: unknown) {
	const provider = await getFileSystemProvider();
	return provider.readFile(fileHandle);
}

export async function writeFile(fileHandle: unknown, content: string) {
	const provider = await getFileSystemProvider();
	return provider.writeFile(fileHandle, content);
}

export async function saveRecentFolder(handle: unknown) {
	const provider = await getFileSystemProvider();
	return provider.saveRecentFolder(handle);
}

export async function getRecentFolder(): Promise<unknown | null> {
	const provider = await getFileSystemProvider();
	return provider.getRecentFolder();
}

export async function getStoredHandle(): Promise<unknown | null> {
	const provider = await getFileSystemProvider();
	return provider.getStoredHandle();
}

export async function searchFiles(
	dirHandle: unknown,
	query: string,
	relativePath = "",
) {
	const provider = await getFileSystemProvider();
	return provider.searchFiles(dirHandle, query, relativePath);
}

export async function requestPermission(handle: unknown): Promise<boolean> {
	const provider = await getFileSystemProvider();
	return provider.requestPermission(handle);
}

export async function getFileHandleByPath(dirHandle: unknown, path: string) {
	const provider = await getFileSystemProvider();
	return provider.getFileHandleByPath(dirHandle, path);
}
