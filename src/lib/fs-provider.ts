export interface FileNode {
	name: string;
	kind: "file" | "directory";
	handle: unknown;
	children?: FileNode[];
	relativePath: string;
	parentHandle?: unknown;
	icon?: any;
}

export interface ReadFileResult {
	content: string;
	lastModified: number;
}

export interface FileSystemProvider {
	readonly name: string;

	pickDirectory(): Promise<{ handle: unknown; name: string } | null>;

	getFileTree(
		dirHandle: unknown,
		relativePath?: string,
		showHiddenFiles?: boolean,
	): Promise<FileNode[]>;

	readFile(fileHandle: unknown): Promise<ReadFileResult>;

	writeFile(fileHandle: unknown, content: string): Promise<number>;

	searchFiles(
		dirHandle: unknown,
		query: string,
		relativePath?: string,
	): Promise<{ node: FileNode; snippet: string }[]>;

	saveRecentFolder(handle: unknown): Promise<void>;

	getRecentFolder(): Promise<unknown | null>;

	getStoredHandle(): Promise<unknown | null>;

	requestPermission(handle: unknown): Promise<boolean>;

	getFileHandleByPath(
		dirHandle: unknown,
		path: string,
	): Promise<unknown | null>;

	deleteEntry(parentHandle: unknown, name: string): Promise<void>;

	createFile(parentHandle: unknown, fileName: string): Promise<unknown>;

	createDirectory(parentHandle: unknown, dirName: string): Promise<unknown>;

	renameEntry(node: FileNode, newName: string): Promise<void>;

	moveEntry(node: FileNode, targetHandle: unknown): Promise<void>;

	writeFileFromBlob(
		parentHandle: unknown,
		fileName: string,
		blob: Blob,
	): Promise<string>;

	readFileAsBlob(
		fileHandle: unknown,
	): Promise<{ blob: Blob; lastModified: number }>;

	resolveImageUrl(fileHandle: unknown): Promise<string>;
}
