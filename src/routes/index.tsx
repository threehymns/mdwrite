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
import { SearchDialog } from "@/components/search-dialog";
import { Sidebar } from "@/components/sidebar";
import { TabBar } from "@/components/tab-bar";
import { TableOfContents } from "@/components/toc";
import { Button } from "@/components/ui/button";
import type { Action } from "@/lib/actions";
import {
	type FileNode,
	getFileTree,
	getRecentFolder,
	getStoredHandle,
	readFile,
	requestPermission,
	saveRecentFolder,
	writeFile,
} from "@/lib/fs";
import { useKeyboardShortcuts } from "@/lib/shortcuts";

export const Route = createFileRoute("/")({ component: App });

const TABS_STORAGE_KEY = "mdwrite-tabs";
const ACTIVE_PATH_STORAGE_KEY = "mdwrite-active-path";
const SIDEBAR_OPEN_STORAGE_KEY = "mdwrite-sidebar-open";

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

function App() {
	const [isSidebarOpen, setIsSidebarOpen] = React.useState(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem(SIDEBAR_OPEN_STORAGE_KEY);
			return saved !== null ? saved === "true" : true;
		}
		return false;
	});
	const [isSearchOpen, setIsSearchOpen] = React.useState(false);
	const [isCommandBarOpen, setIsCommandBarOpen] = React.useState(false);
	const { shortcuts } = useKeyboardShortcuts();
	const [rootHandle, setRootHandle] =
		React.useState<FileSystemDirectoryHandle | null>(null);
	const [storedHandle, setStoredHandle] =
		React.useState<FileSystemDirectoryHandle | null>(null);
	const [files, setFiles] = React.useState<FileNode[]>([]);
	const [tabs, setTabs] = React.useState<FileNode[]>([]);
	const [activePath, setActivePath] = React.useState<string | null>(null);
	const [content, setContent] = React.useState("");
	const [isInitialLoading, setIsInitialLoading] = React.useState(true);
	const lastModifiedRef = React.useRef<number>(0);
	const editorRef = React.useRef<EditorHandle>(null);

	const currentFile = React.useMemo(
		() => tabs.find((t) => t.relativePath === activePath),
		[tabs, activePath],
	);

	const headings = React.useMemo(() => {
		const lines = content.split("\n");
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
	}, [content]);

	const handleHeadingClick = (index: number) => {
		const heading = headings.find((h) => h.index === index);
		if (heading && editorRef.current) {
			editorRef.current.scrollToHeading(heading.text, heading.level);
		}
	};

	const [activeHeadingIndex, setActiveHeadingIndex] = React.useState<number>();

	// Intersection Observer for active heading
	React.useEffect(() => {
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

		const elements = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
		for (const el of elements) observer.observe(el);

		return () => observer.disconnect();
	}, [headings]);

	const refreshFiles = React.useCallback(
		async (handle: FileSystemDirectoryHandle) => {
			const tree = await getFileTree(handle);
			setFiles(tree);
		},
		[],
	);

	const handleOpenFolder = React.useCallback(async () => {
		try {
			const handle = await (
				window as unknown as {
					showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
				}
			).showDirectoryPicker();
			setRootHandle(handle);
			await saveRecentFolder(handle);
			await refreshFiles(handle);
			setIsSidebarOpen(true);
		} catch (err) {
			console.error("Failed to open folder", err);
		}
	}, [refreshFiles]);

	const handleReopenRecent = async () => {
		if (storedHandle) {
			const granted = await requestPermission(storedHandle);
			if (granted) {
				setRootHandle(storedHandle);
				await refreshFiles(storedHandle);
				setIsSidebarOpen(true);
			}
		}
	};

	const handleFileSelect = React.useCallback(
		async (file: FileNode) => {
			if (file.kind === "file") {
				if (!tabs.find((t) => t.relativePath === file.relativePath)) {
					setTabs((prev) => [...prev, file]);
				}
				setActivePath(file.relativePath);
				const { content: text, lastModified } = await readFile(
					file.handle as FileSystemFileHandle,
				);
				lastModifiedRef.current = lastModified;
				setContent(text);
			}
		},
		[tabs],
	);

	const handleTabClose = (path: string) => {
		setTabs((prev) => {
			const newTabs = prev.filter((t) => t.relativePath !== path);
			if (activePath === path) {
				if (newTabs.length > 0) {
					const nextTab = newTabs[newTabs.length - 1];
					handleFileSelect(nextTab);
				} else {
					setActivePath(null);
					setContent("");
				}
			}
			return newTabs;
		});
	};

	const handleDeleteFile = async (node: FileNode) => {
		if (!confirm(`Are you sure you want to delete "${node.name}"?`)) return;

		try {
			if (node.parentHandle) {
				await node.parentHandle.removeEntry(node.name, { recursive: true });
				if (rootHandle) await refreshFiles(rootHandle);

				setTabs((prev) =>
					prev.filter((t) => !t.relativePath.startsWith(node.relativePath)),
				);
				if (activePath?.startsWith(node.relativePath)) {
					setActivePath(null);
					setContent("");
				}
			}
		} catch (err) {
			console.error("Failed to delete", err);
			alert(
				"Failed to delete. It might be in use or you might not have permission.",
			);
		}
	};

	const handleRenameFile = async (node: FileNode, newName: string) => {
		try {
			// @ts-expect-error
			if (typeof node.handle.move === "function") {
				// @ts-expect-error
				await node.handle.move(newName);
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

				if (activePath === node.relativePath) {
					setActivePath(node.relativePath.replace(node.name, newName));
				}
			} else {
				alert("Renaming is not supported in this browser.");
			}
		} catch (err) {
			console.error("Failed to rename", err);
			alert("Failed to rename. Check if a file with that name already exists.");
		}
	};

	const handleNewFile = React.useCallback(async () => {
		if (!rootHandle) return;
		const fileName = prompt("Enter file name (e.g. notes.md)");
		if (!fileName) return;

		const name = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
		try {
			const fileHandle = await rootHandle.getFileHandle(name, { create: true });
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

	const handleContentChange = (newContent: string) => {
		setContent(newContent);
		if (currentFile && currentFile.handle.kind === "file") {
			writeFile(currentFile.handle as FileSystemFileHandle, newContent)
				.then((lastModified) => {
					lastModifiedRef.current = lastModified;
				})
				.catch((err) => {
					console.error("Failed to auto-save", err);
				});
		}
	};

	const handleImageUpload = async (file: File) => {
		if (!currentFile || !currentFile.parentHandle) return null;

		try {
			const assetsHandle = await currentFile.parentHandle.getDirectoryHandle(
				"assets",
				{ create: true },
			);

			const fileHandle = await assetsHandle.getFileHandle(file.name, {
				create: true,
			});
			const writable = await fileHandle.createWritable();
			await writable.write(file);
			await writable.close();

			if (rootHandle) await refreshFiles(rootHandle);

			return `./assets/${file.name}`;
		} catch (err) {
			console.error("Failed to upload image", err);
			return null;
		}
	};

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
				perform: () => setIsSearchOpen(true),
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
		[handleNewFile, handleOpenFolder, shortcuts],
	);

	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const checkShortcut = (actionId: string) => {
				const combo = shortcuts[actionId];
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
				handleNewFile();
			}
			if (checkShortcut("open-folder")) {
				e.preventDefault();
				handleOpenFolder();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [shortcuts, handleNewFile, handleOpenFolder]);

	// Save state to localStorage
	React.useEffect(() => {
		localStorage.setItem(SIDEBAR_OPEN_STORAGE_KEY, String(isSidebarOpen));
	}, [isSidebarOpen]);

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
		const init = async () => {
			const recent = await getRecentFolder();
			if (recent) {
				setRootHandle(recent);
				const tree = await getFileTree(recent);
				setFiles(tree);

				const savedTabs = localStorage.getItem(TABS_STORAGE_KEY);
				const savedActive = localStorage.getItem(ACTIVE_PATH_STORAGE_KEY);

				if (savedTabs) {
					try {
						const paths = JSON.parse(savedTabs) as string[];
						const restoredTabs: FileNode[] = [];
						for (const path of paths) {
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
								const { content: text, lastModified } = await readFile(
									activeNode.handle as FileSystemFileHandle,
								);
								lastModifiedRef.current = lastModified;
								setContent(text);
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
	}, []);

	React.useEffect(() => {
		if (!currentFile || currentFile.handle.kind !== "file") return;

		const handle = currentFile.handle as FileSystemFileHandle;

		const checkFile = async () => {
			try {
				const file = await handle.getFile();

				if (file.lastModified > lastModifiedRef.current) {
					const text = await file.text();
					if (text !== content) {
						setContent(text);
						lastModifiedRef.current = file.lastModified;
					}
				}
			} catch (err) {
				console.error("Error checking for file changes", err);
			}
		};

		if ("FileSystemObserver" in window) {
			// @ts-expect-error
			const observer = new FileSystemObserver(async (_records) => {
				await checkFile();
			});

			observer.observe(handle);
			return () => observer.disconnect();
		}

		const interval = setInterval(checkFile, 2000);
		return () => clearInterval(interval);
	}, [currentFile, content]);

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
					{storedHandle && (
						<Button
							variant="outline"
							size="lg"
							onClick={handleReopenRecent}
							type="button"
							className="text-foreground"
						>
							Reopen {storedHandle.name}
						</Button>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-screen overflow-hidden text-foreground">
			{isSidebarOpen && (
				<Sidebar
					files={files}
					onFileSelect={handleFileSelect}
					onDelete={handleDeleteFile}
					onRename={handleRenameFile}
					currentFile={currentFile}
					onSearchOpen={() => setIsSearchOpen(true)}
				/>
			)}
			<main className="flex min-w-0 flex-1 flex-col bg-background">
				<TabBar
					tabs={tabs}
					activePath={activePath}
					onTabSelect={handleFileSelect}
					onTabClose={handleTabClose}
					onTabsReorder={setTabs}
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
								{rootHandle.name}
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
					<TableOfContents
						headings={headings}
						onHeadingClick={handleHeadingClick}
						activeHeadingIndex={activeHeadingIndex}
					/>
					{currentFile ? (
						<Editor
							key={activePath}
							content={content}
							onChange={handleContentChange}
							onImageUpload={handleImageUpload}
							editorRef={editorRef}
						/>
					) : (
						<div className="flex h-full items-center justify-center text-muted-foreground">
							Select a file from the sidebar to start editing
						</div>
					)}
				</div>
			</main>
		</div>
	);
}
