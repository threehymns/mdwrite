import {
	FolderOpenIcon,
	PlusSignIcon,
	Search01Icon,
	SidebarLeft01Icon,
	ZapIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { CommandBar } from "@/components/command-bar";
import { Editor, type EditorHandle } from "@/components/editor";
import type { Property } from "@/components/frontmatter-editor";
import {
	frontmatterToProperties,
	InlineFrontmatterEditor,
	serializeProperties,
} from "@/components/frontmatter-editor";
import { GraphTab } from "@/components/graph-tab";
import { ImageTab } from "@/components/image-tab";
import { SearchDialog } from "@/components/search-dialog";
import { Sidebar } from "@/components/sidebar";
import { TabBar } from "@/components/tab-bar";
import { useTheme } from "@/components/theme-provider";
import { TableOfContents } from "@/components/toc";
import { Button } from "@/components/ui/button";
import type { Action } from "@/lib/actions";
import {
	type FileNode,
	getFileSystemProvider,
	getFileTree,
	getRecentFolder,
	getStoredHandle,
	readFile,
	requestPermission,
	saveRecentFolder,
	writeFile,
} from "@/lib/fs";
import { parseInternalLinkMarkdown } from "@/lib/internal-links";
import { parseFrontmatter } from "@/lib/markdown";
import { useKeyboardShortcuts } from "@/lib/shortcuts";

export const Route = createFileRoute("/")({ component: App });

const TABS_STORAGE_KEY = "mdwrite-tabs";
const ACTIVE_PATH_STORAGE_KEY = "mdwrite-active-path";
const SIDEBAR_OPEN_STORAGE_KEY = "mdwrite-sidebar-open";
const SIDEBAR_EXPANDED_PATHS_KEY = "mdwrite-sidebar-expanded-paths";
const CONTENT_STATE_SYNC_DELAY_MS = 180;
const GRAPH_TAB_PATH = "__graph_view__";

function getHandleName(handle: unknown): string {
	if (typeof handle === "string") {
		const parts = handle.split("/").filter(Boolean);
		return parts[parts.length - 1] || handle;
	}
	return (handle as FileSystemDirectoryHandle).name || "Folder";
}

function findNodeByPath(nodes: FileNode[], path: string): FileNode | null {
	for (const node of nodes) {
		if (node.relativePath === path) return node;
		if (node.children) {
			const found = findNodeByPath(node.children, path);
			if (found) return found;
		}
	}
	return null;
}

function getDirectory(path: string): string {
	const lastSlash = path.lastIndexOf("/");
	return lastSlash === -1 ? "" : path.slice(0, lastSlash);
}

function normalizePath(path: string): string {
	const parts = path.split("/").filter(Boolean);
	const result: string[] = [];
	for (const part of parts) {
		if (part === ".") continue;
		if (part === "..") {
			result.pop();
		} else {
			result.push(part);
		}
	}
	return result.join("/");
}

function createGraphTabNode(handle: unknown): FileNode {
	return {
		name: "Graph View",
		kind: "file",
		handle,
		relativePath: GRAPH_TAB_PATH,
	};
}

function App() {
	const [isSidebarOpen, setIsSidebarOpen] = React.useState(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem(SIDEBAR_OPEN_STORAGE_KEY);
			return saved !== null ? saved === "true" : true;
		}
		return false;
	});
	const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem(SIDEBAR_EXPANDED_PATHS_KEY);
			if (saved) {
				try {
					return new Set(JSON.parse(saved));
				} catch {
					return new Set();
				}
			}
		}
		return new Set();
	});
	const [isSearchOpen, setIsSearchOpen] = React.useState(false);
	const [isCommandBarOpen, setIsCommandBarOpen] = React.useState(false);
	const { showHiddenFiles } = useTheme();
	const { shortcuts } = useKeyboardShortcuts();
	const shortcutsRef = React.useRef(shortcuts);
	React.useEffect(() => {
		shortcutsRef.current = shortcuts;
	}, [shortcuts]);
	const [rootHandle, setRootHandle] = React.useState<unknown | null>(null);
	const [storedHandle, setStoredHandle] = React.useState<unknown | null>(null);
	const [files, setFiles] = React.useState<FileNode[]>([]);
	const [tabs, setTabs] = React.useState<FileNode[]>([]);
	const [activePath, setActivePath] = React.useState<string | null>(null);
	const [content, setContent] = React.useState("");
	const [properties, setProperties] = React.useState<Property[]>([]);
	const deferredContent = React.useDeferredValue(content);
	const [isInitialLoading, setIsInitialLoading] = React.useState(true);
	const lastModifiedRef = React.useRef<number>(0);
	const contentRef = React.useRef(content);
	const activePathRef = React.useRef<string | null>(activePath);
	const saveTimeoutRef = React.useRef<Map<string, number>>(new Map());
	const contentSyncTimeoutRef = React.useRef<number | null>(null);
	const pendingContentRef = React.useRef<string | null>(null);
	const pendingContentPathRef = React.useRef<string | null>(null);
	const editorRef = React.useRef<EditorHandle>(null);

	React.useEffect(() => {
		contentRef.current = content;
	}, [content]);

	React.useEffect(() => {
		activePathRef.current = activePath;
	}, [activePath]);

	const cancelPendingContentSync = React.useCallback(() => {
		if (contentSyncTimeoutRef.current !== null) {
			window.clearTimeout(contentSyncTimeoutRef.current);
			contentSyncTimeoutRef.current = null;
		}
		pendingContentRef.current = null;
		pendingContentPathRef.current = null;
	}, []);

	const setContentImmediate = React.useCallback(
		(nextContent: string) => {
			cancelPendingContentSync();
			contentRef.current = nextContent;
			setContent(nextContent);
		},
		[cancelPendingContentSync],
	);

	const flushPendingContentSync = React.useCallback(() => {
		const pendingContent = pendingContentRef.current;
		const pendingPath = pendingContentPathRef.current;
		cancelPendingContentSync();

		if (pendingContent === null) return;
		if (pendingPath !== activePathRef.current) return;

		setContent(pendingContent);
	}, [cancelPendingContentSync]);

	const scheduleContentSync = React.useCallback(
		(nextContent: string, filePath: string | null) => {
			pendingContentRef.current = nextContent;
			pendingContentPathRef.current = filePath;

			if (contentSyncTimeoutRef.current !== null) {
				window.clearTimeout(contentSyncTimeoutRef.current);
			}

			contentSyncTimeoutRef.current = window.setTimeout(() => {
				flushPendingContentSync();
			}, CONTENT_STATE_SYNC_DELAY_MS);
		},
		[flushPendingContentSync],
	);

	const currentFile = React.useMemo(
		() => tabs.find((t) => t.relativePath === activePath),
		[tabs, activePath],
	);

	const headings = React.useMemo(() => {
		const lines = deferredContent.split("\n");
		const result: { level: number; text: string; index: number }[] = [];
		for (let i = 0; i < lines.length; i++) {
			const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
			if (match) {
				result.push({
					level: match[1].length,
					text: match[2],
					index: i,
				});
			}
		}
		return result;
	}, [deferredContent]);

	const handleHeadingClick = (index: number) => {
		const heading = headings.find((h) => h.index === index);
		if (heading && editorRef.current) {
			editorRef.current.scrollToHeading(heading.text, heading.level);
		}
	};

	const [activeHeadingIndex, setActiveHeadingIndex] = React.useState<number>();

	// Intersection Observer for active heading
	React.useEffect(() => {
		if (headings.length === 0) {
			setActiveHeadingIndex(undefined);
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				const intersecting = entries
					.filter((entry) => entry.isIntersecting)
					.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

				if (intersecting.length > 0) {
					const visibleEntry = intersecting[0];
					const headingText = visibleEntry.target.textContent;
					const headingLevel = Number.parseInt(
						visibleEntry.target.tagName.substring(1),
						10,
					);
					const heading = headings.find(
						(h) => h.text === headingText && h.level === headingLevel,
					);
					if (heading) {
						setActiveHeadingIndex(heading.index);
					}
				}
			},
			{
				rootMargin: "-80px 0px -80% 0px",
				threshold: [0, 1],
			},
		);

		const elements = document.querySelectorAll(
			".ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6",
		);
		for (const el of elements) observer.observe(el);

		return () => observer.disconnect();
	}, [headings]);

	const refreshFiles = React.useCallback(
		async (handle: unknown) => {
			const tree = await getFileTree(handle, "", showHiddenFiles);
			setFiles(tree);
		},
		[showHiddenFiles],
	);

	const handleNewFileRef = React.useRef<() => void>(() => {});
	const handleOpenFolderRef = React.useRef<() => void>(() => {});

	const handleOpenFolder = React.useCallback(async () => {
		try {
			const provider = await getFileSystemProvider();
			const result = await provider.pickDirectory();
			if (!result) return;
			setRootHandle(result.handle);
			await saveRecentFolder(result.handle);
			await refreshFiles(result.handle);
			setIsSidebarOpen(true);
		} catch (err) {
			console.error("Failed to open folder", err);
		}
	}, [refreshFiles]);

	React.useEffect(() => {
		handleOpenFolderRef.current = handleOpenFolder;
	}, [handleOpenFolder]);

	const handleReopenRecent = async () => {
		if (storedHandle) {
			const granted = await requestPermission(storedHandle);
			if (granted) {
				setRootHandle(storedHandle);
				await refreshFiles(storedHandle);
				setIsSidebarOpen(true);

				// Restore tabs from localStorage
				const savedTabs = localStorage.getItem(TABS_STORAGE_KEY);
				const savedActive = localStorage.getItem(ACTIVE_PATH_STORAGE_KEY);
				const showHiddenFilesOnInit =
					localStorage.getItem("showHiddenFiles") === "true";

				if (savedTabs) {
					try {
						const tree = await getFileTree(
							storedHandle,
							"",
							showHiddenFilesOnInit,
						);
						const paths = JSON.parse(savedTabs) as string[];
						const restoredTabs: FileNode[] = [];
						for (const path of paths) {
							if (path === GRAPH_TAB_PATH) {
								restoredTabs.push(createGraphTabNode(storedHandle));
								continue;
							}
							const node = findNodeByPath(tree, path);
							if (node) restoredTabs.push(node);
						}
						setTabs(restoredTabs);

						if (savedActive) {
							const activeNode = restoredTabs.find(
								(t) => t.relativePath === savedActive,
							);
							if (activeNode) {
								setActivePath(activeNode.relativePath);
								if (activeNode.relativePath === GRAPH_TAB_PATH) {
									setContentImmediate("");
									setProperties([]);
								} else {
									const { content: text, lastModified } = await readFile(
										activeNode.handle,
									);
									lastModifiedRef.current = lastModified;
									const {
										frontmatter: fm,
										hasFrontmatter,
										body,
									} = parseFrontmatter(text);
									const props = hasFrontmatter
										? frontmatterToProperties(fm)
										: [];
									setProperties(props);
									const processed = parseInternalLinkMarkdown(
										hasFrontmatter ? body : text,
									);
									setContentImmediate(processed);
								}
							}
						}
					} catch (e) {
						console.error("Failed to restore tabs", e);
					}
				}
			}
		}
	};

	const handleSearchOpen = React.useCallback(() => {
		setIsSearchOpen(true);
	}, []);

	const openGraphViewTab = React.useCallback(() => {
		if (!rootHandle) return;
		const graphTab = createGraphTabNode(rootHandle);
		setTabs((prev) => {
			if (prev.some((tab) => tab.relativePath === GRAPH_TAB_PATH)) {
				return prev;
			}
			return [...prev, graphTab];
		});
		setActivePath(GRAPH_TAB_PATH);
	}, [rootHandle]);

	const handleFileSelect = React.useCallback(
		async (file: FileNode) => {
			if (file.kind === "file") {
				if (file.relativePath === GRAPH_TAB_PATH) {
					setTabs((prev) => {
						if (prev.some((tab) => tab.relativePath === GRAPH_TAB_PATH)) {
							return prev;
						}
						return [...prev, file];
					});
					setActivePath(GRAPH_TAB_PATH);
					return;
				}

				cancelPendingContentSync();
				const isImage = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"].some(
					(ext) => file.name.toLowerCase().endsWith(ext),
				);

				setTabs((prev) => {
					if (prev.some((t) => t.relativePath === file.relativePath)) {
						return prev;
					}
					return [...prev, file];
				});
				setActivePath(file.relativePath);

				if (!isImage) {
					const { content: text, lastModified } = await readFile(file.handle);
					lastModifiedRef.current = lastModified;
					const {
						frontmatter: fm,
						hasFrontmatter,
						body,
					} = parseFrontmatter(text);
					const props = hasFrontmatter ? frontmatterToProperties(fm) : [];
					setProperties(props);
					const processed = parseInternalLinkMarkdown(
						hasFrontmatter ? body : text,
					);
					setContentImmediate(processed);
				}
			}
		},
		[cancelPendingContentSync, setContentImmediate],
	);

	const handleOpenGraphFile = React.useCallback(
		(path: string) => {
			const fileNode = findNodeByPath(files, path);
			if (!fileNode || fileNode.kind !== "file") return;
			void handleFileSelect(fileNode);
		},
		[files, handleFileSelect],
	);

	const pendingAnchorRef = React.useRef<string | null>(null);

	const handleInternalLinkClick = React.useCallback(
		(target: string) => {
			let resolvedTarget = target.trim();
			if (resolvedTarget.startsWith("<") && resolvedTarget.endsWith(">")) {
				resolvedTarget = resolvedTarget.slice(1, -1).trim();
			}
			if (
				resolvedTarget.startsWith("internal-link:") ||
				resolvedTarget.startsWith("internal-link-embed:")
			) {
				const schemeSplit = resolvedTarget.split(":", 2);
				resolvedTarget = resolvedTarget.slice(schemeSplit[0].length + 1);
			}
			if (/^[a-z]+:/i.test(resolvedTarget)) return;
			if (resolvedTarget.startsWith("#")) {
				const heading = resolvedTarget.slice(1);
				if (editorRef.current && heading) {
					const headingMatch = headings.find(
						(h) => h.text.toLowerCase() === heading.toLowerCase(),
					);
					if (headingMatch) {
						editorRef.current.scrollToHeading(
							headingMatch.text,
							headingMatch.level,
						);
					}
				}
				return;
			}

			const decoded = (() => {
				try {
					return decodeURIComponent(resolvedTarget);
				} catch {
					return resolvedTarget;
				}
			})();

			const [pathPart] = decoded.split("#");
			const anchor = decoded.includes("#") ? decoded.split("#")[1] : null;

			const currentDir = activePath ? getDirectory(activePath) : "";
			const absolute = pathPart.startsWith("/")
				? normalizePath(pathPart.slice(1))
				: normalizePath(`${currentDir}/${pathPart}`);

			const fileNode = findNodeByPath(files, absolute);
			if (!fileNode || fileNode.kind !== "file") return;

			const isCurrentFile = fileNode.relativePath === activePath;
			if (isCurrentFile && anchor && editorRef.current) {
				const headingMatch = headings.find(
					(h) => h.text.toLowerCase() === anchor.toLowerCase(),
				);
				if (headingMatch) {
					editorRef.current.scrollToHeading(
						headingMatch.text,
						headingMatch.level,
					);
				}
				return;
			}

			pendingAnchorRef.current = anchor;
			void handleFileSelect(fileNode);
		},
		[files, handleFileSelect, activePath, headings],
	);

	React.useEffect(() => {
		const anchor = pendingAnchorRef.current;
		if (!anchor || !editorRef.current) return;

		const headingMatch = headings.find(
			(h) => h.text.toLowerCase() === anchor.toLowerCase(),
		);
		if (headingMatch) {
			setTimeout(() => {
				editorRef.current?.scrollToHeading(
					headingMatch.text,
					headingMatch.level,
				);
			}, 100);
		}
		pendingAnchorRef.current = null;
	}, [activePath, headings]);

	const handleTabClose = (path: string) => {
		setTabs((prev) => {
			const newTabs = prev.filter((t) => t.relativePath !== path);
			if (activePath === path) {
				if (newTabs.length > 0) {
					const nextTab = newTabs[newTabs.length - 1];
					handleFileSelect(nextTab);
				} else {
					setActivePath(null);
					setContentImmediate("");
				}
			}
			return newTabs;
		});
	};

	const handleTabsCloseOther = (keepPath: string) => {
		setTabs((prev) => {
			const keepTab = prev.find((t) => t.relativePath === keepPath);
			if (!keepTab) return prev;
			setActivePath(keepPath);
			handleFileSelect(keepTab);
			return [keepTab];
		});
	};

	const handleTabsCloseToRight = (fromPath: string) => {
		setTabs((prev) => {
			const fromIndex = prev.findIndex((t) => t.relativePath === fromPath);
			if (fromIndex === -1) return prev;
			const newTabs = prev.slice(0, fromIndex + 1);
			return newTabs;
		});
	};

	const handleCopyFilePath = (path: string) => {
		navigator.clipboard.writeText(path);
	};

	const handleDeleteFile = React.useCallback(
		async (node: FileNode) => {
			if (!confirm(`Are you sure you want to delete "${node.name}"?`)) return;

			try {
				if (node.parentHandle) {
					const provider = await getFileSystemProvider();
					await provider.deleteEntry(node.parentHandle, node.name);
					if (rootHandle) await refreshFiles(rootHandle);

					setTabs((prev) =>
						prev.filter((t) => !t.relativePath.startsWith(node.relativePath)),
					);
					if (activePathRef.current?.startsWith(node.relativePath)) {
						setActivePath(null);
						setContentImmediate("");
					}
				}
			} catch (err) {
				console.error("Failed to delete", err);
				alert(
					"Failed to delete. It might be in use or you might not have permission.",
				);
			}
		},
		[refreshFiles, rootHandle, setContentImmediate],
	);

	const handleRenameFile = React.useCallback(
		async (node: FileNode, newName: string) => {
			try {
				const provider = await getFileSystemProvider();
				await provider.renameEntry(node, newName);
				if (rootHandle) await refreshFiles(rootHandle);

				setTabs((prev) =>
					prev.map((t) => {
						if (t.relativePath === node.relativePath) {
							const newRelativePath = t.relativePath.replace(
								node.name,
								newName,
							);
							return { ...t, name: newName, relativePath: newRelativePath };
						}
						return t;
					}),
				);

				if (activePathRef.current === node.relativePath) {
					setActivePath(node.relativePath.replace(node.name, newName));
				}
			} catch (err) {
				console.error("Failed to rename", err);
				alert(
					"Failed to rename. Check if a file with that name already exists.",
				);
			}
		},
		[refreshFiles, rootHandle],
	);

	const handleMoveFile = React.useCallback(
		async (node: FileNode, targetDirectory: FileNode) => {
			if (targetDirectory.kind !== "directory") return;
			if (node.relativePath === targetDirectory.relativePath) return;
			if (
				node.kind === "directory" &&
				targetDirectory.relativePath.startsWith(`${node.relativePath}/`)
			) {
				return;
			}

			try {
				const provider = await getFileSystemProvider();
				await provider.moveEntry(node, targetDirectory.handle);

				const oldPrefix = node.relativePath;
				const newPrefix = `${targetDirectory.relativePath}/${node.name}`;

				setTabs((prev) =>
					prev.map((tab) => {
						if (
							tab.relativePath !== oldPrefix &&
							!tab.relativePath.startsWith(`${oldPrefix}/`)
						) {
							return tab;
						}
						return {
							...tab,
							relativePath: `${newPrefix}${tab.relativePath.slice(oldPrefix.length)}`,
						};
					}),
				);

				if (
					activePathRef.current === oldPrefix ||
					activePathRef.current?.startsWith(`${oldPrefix}/`)
				) {
					setActivePath(
						`${newPrefix}${activePathRef.current.slice(oldPrefix.length)}`,
					);
				}

				if (rootHandle) await refreshFiles(rootHandle);
			} catch (err) {
				console.error("Failed to move", err);
				alert("Failed to move. Check for permissions or name conflicts.");
			}
		},
		[refreshFiles, rootHandle],
	);

	const handleNewFile = React.useCallback(async () => {
		if (!rootHandle) return;
		const fileName = prompt("Enter file name (e.g. notes.md)");
		if (!fileName) return;

		const name = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
		try {
			const provider = await getFileSystemProvider();
			const fileHandle = await provider.createFile(rootHandle, name);
			await refreshFiles(rootHandle);
			const newNode: FileNode = {
				name,
				kind: "file",
				handle: fileHandle,
				relativePath: name,
				parentHandle: rootHandle,
			};
			handleFileSelect(newNode);
		} catch (err) {
			console.error("Failed to create file", err);
		}
	}, [rootHandle, refreshFiles, handleFileSelect]);

	React.useEffect(() => {
		handleNewFileRef.current = handleNewFile;
	}, [handleNewFile]);

	const handleCreateNote = React.useCallback(
		async (parentDirPath: string) => {
			const fileName = prompt("Enter file name (e.g. notes.md)");
			if (!fileName) return;

			const name = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
			try {
				const provider = await getFileSystemProvider();
				const fullParentPath = parentDirPath
					? `${rootHandle}/${parentDirPath}`
					: rootHandle;
				const fileHandle = await provider.createFile(fullParentPath, name);
				if (rootHandle) await refreshFiles(rootHandle);
				const relativePath = parentDirPath ? `${parentDirPath}/${name}` : name;
				const newNode: FileNode = {
					name,
					kind: "file",
					handle: fileHandle,
					relativePath,
					parentHandle: fullParentPath,
				};
				handleFileSelect(newNode);
			} catch (err) {
				console.error("Failed to create file", err);
			}
		},
		[rootHandle, refreshFiles, handleFileSelect],
	);

	const handleCreateFolder = React.useCallback(
		async (parentDirPath: string) => {
			const folderName = prompt("Enter folder name");
			if (!folderName) return;

			try {
				const provider = await getFileSystemProvider();
				const fullParentPath = parentDirPath
					? `${rootHandle}/${parentDirPath}`
					: rootHandle;
				await provider.createDirectory(fullParentPath, folderName);
				if (rootHandle) await refreshFiles(rootHandle);
			} catch (err) {
				console.error("Failed to create folder", err);
			}
		},
		[rootHandle, refreshFiles],
	);

	const handleContentChange = React.useCallback(
		(newContent: string) => {
			contentRef.current = newContent;
			scheduleContentSync(newContent, currentFile?.relativePath ?? null);

			if (!currentFile || currentFile.kind !== "file") return;

			const filePath = currentFile.relativePath;

			const existingTimeout = saveTimeoutRef.current.get(filePath);
			if (existingTimeout !== undefined) {
				window.clearTimeout(existingTimeout);
			}

			const timeoutId = window.setTimeout(() => {
				saveTimeoutRef.current.delete(filePath);
				const fmStr = serializeProperties(properties);
				const fullContent = fmStr + newContent;
				writeFile(currentFile.handle, fullContent)
					.then((lastModified) => {
						lastModifiedRef.current = lastModified;
					})
					.catch((err) => {
						console.error("Failed to auto-save", err);
					});
			}, 300);

			saveTimeoutRef.current.set(filePath, timeoutId);
		},
		[currentFile, scheduleContentSync, properties],
	);

	React.useEffect(() => {
		return () => {
			cancelPendingContentSync();
			saveTimeoutRef.current.forEach((timeoutId) => {
				window.clearTimeout(timeoutId);
			});
			saveTimeoutRef.current.clear();
		};
	}, [cancelPendingContentSync]);

	const handleImageUpload = React.useCallback(
		async (file: File) => {
			if (!currentFile || !currentFile.parentHandle) return null;

			try {
				const provider = await getFileSystemProvider();
				const path = await provider.writeFileFromBlob(
					currentFile.parentHandle,
					file.name,
					file,
				);

				if (rootHandle) await refreshFiles(rootHandle);

				return path;
			} catch (err) {
				console.error("Failed to upload image", err);
				return null;
			}
		},
		[currentFile, refreshFiles, rootHandle],
	);

	const handleResolveImagePath = React.useCallback(
		async (path: string) => {
			if (
				path.startsWith("http") ||
				path.startsWith("data:") ||
				path.startsWith("blob:")
			) {
				return path;
			}

			if (!currentFile || !currentFile.parentHandle) return null;

			const provider = await getFileSystemProvider();
			const fileHandle = await provider.getFileHandleByPath(
				currentFile.parentHandle,
				path,
			);
			if (fileHandle) {
				return await provider.resolveImageUrl(fileHandle);
			}

			return null;
		},
		[currentFile],
	);

	const actions: Action[] = React.useMemo(
		() => [
			{
				id: "new-file",
				title: "New File",
				description: "Create a new markdown file",
				icon: PlusSignIcon as any,
				shortcut: shortcuts["new-file"],
				perform: handleNewFile,
			},
			{
				id: "search",
				title: "Search Content",
				description: "Search in all markdown files",
				icon: Search01Icon as any,
				shortcut: shortcuts.search,
				perform: handleSearchOpen,
			},
			{
				id: "command-bar",
				title: "Command Bar",
				description: "Open the command bar",
				icon: ZapIcon as any,
				shortcut: shortcuts["command-bar"],
				perform: () => setIsCommandBarOpen(true),
			},
			{
				id: "graph-view",
				title: "Graph View",
				description: "Open graph view",
				icon: Search01Icon as any,
				perform: openGraphViewTab,
			},
			{
				id: "toggle-sidebar",
				title: "Toggle Sidebar",
				description: "Show or hide the file sidebar",
				icon: SidebarLeft01Icon as any,
				shortcut: shortcuts["toggle-sidebar"],
				perform: () => setIsSidebarOpen((prev) => !prev),
			},
			{
				id: "open-folder",
				title: "Open Folder",
				description: "Open a different folder",
				icon: FolderOpenIcon as any,
				shortcut: shortcuts["open-folder"],
				perform: handleOpenFolder,
			},
		],
		[
			handleNewFile,
			handleOpenFolder,
			handleSearchOpen,
			openGraphViewTab,
			shortcuts,
		],
	);

	const handleDirectoryToggle = React.useCallback(
		(path: string, isExpanded: boolean) => {
			setExpandedPaths((prev) => {
				const next = new Set(prev);
				if (isExpanded) {
					next.add(path);
				} else {
					next.delete(path);
				}
				return next;
			});
		},
		[],
	);

	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const checkShortcut = (actionId: string) => {
				const combo = shortcutsRef.current[actionId];
				if (!combo) return false;

				const hasCtrl = combo.includes("ctrl");
				const hasShift = combo.includes("shift");
				const hasAlt = combo.includes("alt");
				const key = combo.find((k) => !["ctrl", "shift", "alt"].includes(k));

				return (
					(hasCtrl ? e.ctrlKey || e.metaKey : true) &&
					(hasShift ? e.shiftKey : true) &&
					(hasAlt ? e.altKey : true) &&
					e.key.toLowerCase() === key
				);
			};

			if (checkShortcut("toggle-sidebar")) {
				e.preventDefault();
				setIsSidebarOpen((prev) => !prev);
			}
			if (checkShortcut("search")) {
				e.preventDefault();
				setIsSearchOpen(true);
			}
			if (checkShortcut("command-bar")) {
				e.preventDefault();
				setIsCommandBarOpen(true);
			}
			if (checkShortcut("new-file")) {
				e.preventDefault();
				handleNewFileRef.current();
			}
			if (checkShortcut("open-folder")) {
				e.preventDefault();
				handleOpenFolderRef.current();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	// Save state to localStorage
	React.useEffect(() => {
		localStorage.setItem(SIDEBAR_OPEN_STORAGE_KEY, String(isSidebarOpen));
	}, [isSidebarOpen]);

	React.useEffect(() => {
		localStorage.setItem(
			SIDEBAR_EXPANDED_PATHS_KEY,
			JSON.stringify([...expandedPaths]),
		);
	}, [expandedPaths]);

	React.useEffect(() => {
		localStorage.setItem(
			TABS_STORAGE_KEY,
			JSON.stringify(tabs.map((t) => t.relativePath)),
		);
	}, [tabs]);

	React.useEffect(() => {
		if (activePath) {
			localStorage.setItem(ACTIVE_PATH_STORAGE_KEY, activePath);
		}
	}, [activePath]);

	React.useEffect(() => {
		if (!rootHandle) return;
		void refreshFiles(rootHandle);
	}, [rootHandle, refreshFiles]);

	React.useEffect(() => {
		const init = async () => {
			const showHiddenFilesOnInit =
				localStorage.getItem("showHiddenFiles") === "true";
			const savedTabs = localStorage.getItem(TABS_STORAGE_KEY);
			const savedActive = localStorage.getItem(ACTIVE_PATH_STORAGE_KEY);
			const recent = await getRecentFolder();

			if (recent) {
				setRootHandle(recent);
				const tree = await getFileTree(recent, "", showHiddenFilesOnInit);
				setFiles(tree);

				if (savedTabs) {
					try {
						const paths = JSON.parse(savedTabs) as string[];
						const restoredTabs: FileNode[] = [];
						for (const path of paths) {
							if (path === GRAPH_TAB_PATH) {
								restoredTabs.push(createGraphTabNode(recent));
								continue;
							}
							const node = findNodeByPath(tree, path);
							if (node) restoredTabs.push(node);
						}
						setTabs(restoredTabs);

						if (savedActive) {
							const activeNode = restoredTabs.find(
								(t) => t.relativePath === savedActive,
							);
							if (activeNode) {
								setActivePath(activeNode.relativePath);
								if (activeNode.relativePath === GRAPH_TAB_PATH) {
									setContentImmediate("");
									setProperties([]);
								} else {
									const { content: text, lastModified } = await readFile(
										activeNode.handle,
									);
									lastModifiedRef.current = lastModified;
									const {
										frontmatter: fm,
										hasFrontmatter,
										body,
									} = parseFrontmatter(text);
									const props = hasFrontmatter
										? frontmatterToProperties(fm)
										: [];
									setProperties(props);
									const processed = parseInternalLinkMarkdown(
										hasFrontmatter ? body : text,
									);
									setContentImmediate(processed);
								}
							}
						}
					} catch (e) {
						console.error("Failed to restore tabs", e);
					}
				}
			} else {
				const stored = await getStoredHandle();
				if (stored) {
					setStoredHandle(stored);
				}
			}
			setIsInitialLoading(false);
		};
		init();
	}, [setContentImmediate]);

	React.useEffect(() => {
		if (!currentFile || currentFile.kind !== "file") return;

		const checkFile = async () => {
			try {
				const provider = await getFileSystemProvider();
				const { content: text, lastModified } = await provider.readFile(
					currentFile.handle,
				);

				if (lastModified > lastModifiedRef.current) {
					if (text !== contentRef.current) {
						const {
							frontmatter: fm,
							hasFrontmatter,
							body,
						} = parseFrontmatter(text);
						const props = hasFrontmatter
							? frontmatterToProperties(fm, properties)
							: [];
						setProperties(props);
						const processed = parseInternalLinkMarkdown(
							hasFrontmatter ? body : text,
						);
						setContentImmediate(processed);
						lastModifiedRef.current = lastModified;
					}
				}
			} catch (err) {
				console.error("Error checking for file changes", err);
			}
		};

		if (typeof window !== "undefined" && "FileSystemObserver" in window) {
			// @ts-expect-error - FileSystemObserver is an experimental API
			const observer = new FileSystemObserver(async (_records: unknown) => {
				await checkFile();
			});

			observer.observe(currentFile.handle);
			return () => observer.disconnect();
		}

		const interval = setInterval(checkFile, 2000);
		return () => clearInterval(interval);
	}, [currentFile, setContentImmediate, properties]);

	if (isInitialLoading) {
		return (
			<div className="flex h-screen items-center justify-center bg-background">
				<div className="h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
			</div>
		);
	}

	if (!rootHandle) {
		return (
			<div className="flex h-screen flex-col items-center justify-center gap-6 bg-background">
				<div className="space-y-2 text-center">
					<h1 className="font-bold text-4xl text-foreground tracking-tight">
						Welcome to MDWrite
					</h1>
					<p className="text-muted-foreground">
						A clean, focused markdown editor for your local files.
					</p>
				</div>
				<div className="flex w-64 flex-col gap-3">
					<Button size="lg" onClick={handleOpenFolder} type="button">
						<HugeiconsIcon icon={FolderOpenIcon} className="mr-2 h-5 w-5" />
						Open Folder
					</Button>
					{storedHandle != null && (
						<Button
							variant="outline"
							size="lg"
							onClick={handleReopenRecent}
							type="button"
							className="text-foreground"
						>
							Reopen {getHandleName(storedHandle)}
						</Button>
					)}
				</div>
			</div>
		);
	}

	const currentIsImage = [
		".png",
		".jpg",
		".jpeg",
		".gif",
		".svg",
		".webp",
	].some((ext) => currentFile?.name.toLowerCase().endsWith(ext));
	const currentIsGraph = currentFile?.relativePath === GRAPH_TAB_PATH;

	return (
		<div className="flex h-screen overflow-hidden text-foreground">
			{isSidebarOpen && (
				<Sidebar
					files={files}
					onFileSelect={handleFileSelect}
					onDelete={handleDeleteFile}
					onRename={handleRenameFile}
					onMove={handleMoveFile}
					onCreateFolder={handleCreateFolder}
					onCreateNote={handleCreateNote}
					activePath={activePath}
					onSearchOpen={handleSearchOpen}
					expandedPaths={expandedPaths}
					onDirectoryToggle={handleDirectoryToggle}
				/>
			)}
			<main className="flex min-w-0 flex-1 flex-col bg-background">
				<TabBar
					tabs={tabs}
					activePath={activePath}
					onTabSelect={handleFileSelect}
					onTabClose={handleTabClose}
					onTabsCloseOther={handleTabsCloseOther}
					onTabsCloseToRight={handleTabsCloseToRight}
					onTabsReorder={setTabs}
					onCopyFilePath={handleCopyFilePath}
					left={
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setIsSidebarOpen((prev) => !prev)}
							type="button"
							className="h-8 w-8"
						>
							<HugeiconsIcon icon={SidebarLeft01Icon} className="h-4 w-4" />
						</Button>
					}
					right={
						<div className="flex items-center gap-2">
							<span className="hidden text-muted-foreground text-xs lg:inline">
								{getHandleName(rootHandle)}
							</span>
							<Button
								variant="outline"
								size="sm"
								onClick={handleOpenFolder}
								type="button"
								className="h-8"
							>
								Change
							</Button>
						</div>
					}
				/>
				<div className="relative flex flex-1 flex-col overflow-hidden">
					<CommandBar
						isOpen={isCommandBarOpen}
						onClose={() => setIsCommandBarOpen(false)}
						actions={actions}
					/>
					<SearchDialog
						isOpen={isSearchOpen}
						onClose={() => setIsSearchOpen(false)}
						rootHandle={rootHandle}
						onFileSelect={handleFileSelect}
					/>
					{currentFile && !currentIsImage && !currentIsGraph && (
						<>
							{properties.length > 0 && (
								<InlineFrontmatterEditor
									properties={properties}
									onChange={(newProps) => {
										setProperties(newProps);
										const hasEmptyKeys = newProps.some(
											(p) => p.key.trim() === "",
										);
										if (hasEmptyKeys) return;
										const fmStr = serializeProperties(newProps);
										const fullContent = fmStr + content;
										if (currentFile && currentFile.kind === "file") {
											writeFile(currentFile.handle, fullContent)
												.then((lastModified) => {
													lastModifiedRef.current = lastModified;
												})
												.catch(console.error);
										}
									}}
									onClose={() => {}}
								/>
							)}
							<TableOfContents
								headings={headings}
								onHeadingClick={handleHeadingClick}
								activeHeadingIndex={activeHeadingIndex}
							/>
						</>
					)}
					<div className="relative flex flex-1 flex-col overflow-hidden">
						{tabs.map((tab) => {
							if (tab.relativePath === GRAPH_TAB_PATH) {
								if (tab.relativePath !== activePath) return null;
								return (
									<GraphTab
										key={tab.relativePath}
										files={files}
										onOpenFilePath={handleOpenGraphFile}
									/>
								);
							}

							const isImage = [
								".png",
								".jpg",
								".jpeg",
								".gif",
								".svg",
								".webp",
							].some((ext) => tab.name.toLowerCase().endsWith(ext));

							if (isImage) {
								if (tab.relativePath !== activePath) return null;
								return <ImageTab key={tab.relativePath} file={tab} />;
							}

							return (
								<React.Activity
									key={tab.relativePath}
									mode={tab.relativePath === activePath ? "visible" : "hidden"}
								>
									<div className="flex flex-1 overflow-hidden">
										<Editor
											content={content}
											onChange={handleContentChange}
											onImageUpload={handleImageUpload}
											resolveImagePath={handleResolveImagePath}
											editorRef={
												tab.relativePath === activePath ? editorRef : undefined
											}
											active={tab.relativePath === activePath}
											onFrontmatterTrigger={() => {
												setProperties([{ key: "", type: "text", value: "" }]);
											}}
											onInternalLinkClick={handleInternalLinkClick}
										/>
									</div>
								</React.Activity>
							);
						})}
						{!currentFile && (
							<div className="flex h-full items-center justify-center text-muted-foreground">
								Select a file from the sidebar to start editing
							</div>
						)}
					</div>
				</div>
			</main>
		</div>
	);
}
