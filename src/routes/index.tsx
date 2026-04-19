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
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Action } from "@/lib/actions";
import {
  type FileNode,
  getFileHandleByPath,
  getFileTree,
  getRecentFolders,
  getStoredHandle,
  readFile,
  requestPermission,
  saveRecentFolders,
  writeFile,
} from "@/lib/fs";
import { parseInternalLinkMarkdown } from "@/lib/internal-links";
import { parseFrontmatter } from "@/lib/markdown";
import { useKeyboardShortcuts } from "@/lib/shortcuts";

export const Route = createFileRoute("/")({ component: App });

const TABS_STORAGE_KEY_BASE = "mdwrite-tabs";
const ACTIVE_PATH_STORAGE_KEY_BASE = "mdwrite-active-path";
const SIDEBAR_OPEN_STORAGE_KEY_BASE = "mdwrite-sidebar-open";
const SIDEBAR_EXPANDED_PATHS_KEY_BASE = "mdwrite-sidebar-expanded-paths";
const CONTENT_STATE_SYNC_DELAY_MS = 180;
const GRAPH_TAB_PATH = "__graph_view__";

function getStorageKey(baseKey: string, folderName: string | null): string {
  if (!folderName) return baseKey;
  return `${baseKey}-${folderName}`;
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

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"];

function isImageFile(name: string): boolean {
  return IMAGE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));
}

function createGraphTabNode(handle: FileSystemHandle): FileNode {
  return {
    name: "Graph View",
    kind: "file",
    handle,
    relativePath: GRAPH_TAB_PATH,
  };
}

async function loadFileContent(
  handle: FileSystemFileHandle,
  lastModifiedRef: React.MutableRefObject<number>,
  setProperties: (props: Property[]) => void,
  setContent: (content: string) => void,
) {
  const { content: text, lastModified } = await readFile(handle);
  lastModifiedRef.current = lastModified;
  const { frontmatter: fm, hasFrontmatter, body } = parseFrontmatter(text);
  setProperties(hasFrontmatter ? frontmatterToProperties(fm) : []);
  setContent(parseInternalLinkMarkdown(hasFrontmatter ? body : text));
}

interface FolderSwitcherProps {
  currentRoot: FileSystemDirectoryHandle | null;
  onFolderSelect: (handle: FileSystemDirectoryHandle) => Promise<void>;
  onOpenFolder: () => void;
  isOpen: boolean;
}

function FolderSwitcher({
  currentRoot,
  onFolderSelect,
  onOpenFolder,
  isOpen,
}: FolderSwitcherProps) {
  const [recentFolders, setRecentFolders] = React.useState<
    FileSystemDirectoryHandle[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (!isOpen) return;
    const loadRecentFolders = async () => {
      setIsLoading(true);
      const folders = await getRecentFolders();
      setRecentFolders(folders ?? []);
      setIsLoading(false);
    };
    void loadRecentFolders();
  }, [isOpen]);

  const handleFolderSelect = async (handle: FileSystemDirectoryHandle) => {
    const granted = await requestPermission(handle);
    if (granted) {
      await onFolderSelect(handle);
    }
  };

  const availableRecents = recentFolders.filter(
    (folder) => !currentRoot || folder.name !== currentRoot.name,
  );

  return (
    <Command>
      <CommandInput placeholder="Filter" />
      <CommandList className="mt-1">
        {isLoading ? (
          <div className="px-3 py-2 text-muted-foreground text-sm">
            Loading...
          </div>
        ) : (
          <>
            {availableRecents.map((folder) => (
              <CommandItem
                key={folder.name}
                onSelect={() => void handleFolderSelect(folder)}
                className="cursor-pointer truncate"
              >
                {folder.name}
              </CommandItem>
            ))}
            {availableRecents.length > 0 && <CommandSeparator />}
            <CommandItem
              onSelect={onOpenFolder}
              className="cursor-pointer text-muted-foreground"
            >
              Open folder...
            </CommandItem>
          </>
        )}
      </CommandList>
    </Command>
  );
}

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(
    new Set(),
  );
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [isCommandBarOpen, setIsCommandBarOpen] = React.useState(false);
  const [isFolderSwitcherOpen, setIsFolderSwitcherOpen] = React.useState(false);
  const { showHiddenFiles } = useTheme();
  const { shortcuts } = useKeyboardShortcuts();
  const shortcutsRef = React.useRef(shortcuts);
  React.useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);
  const isSwitchingFolderRef = React.useRef(false);
  const [rootHandle, setRootHandle] =
    React.useState<FileSystemDirectoryHandle | null>(null);
  const [storedHandle, setStoredHandle] =
    React.useState<FileSystemDirectoryHandle | null>(null);
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
  const tabsRef = React.useRef<FileNode[]>(tabs);
  const rootHandleRef = React.useRef<FileSystemDirectoryHandle | null>(
    rootHandle,
  );
  const isSidebarOpenRef = React.useRef<boolean>(isSidebarOpen);
  const expandedPathsRef = React.useRef<Set<string>>(expandedPaths);
  const loadGenerationRef = React.useRef(0);

  React.useEffect(() => {
    contentRef.current = content;
  }, [content]);

  React.useEffect(() => {
    activePathRef.current = activePath;
  }, [activePath]);

  React.useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  React.useEffect(() => {
    rootHandleRef.current = rootHandle;
  }, [rootHandle]);

  React.useEffect(() => {
    isSidebarOpenRef.current = isSidebarOpen;
  }, [isSidebarOpen]);

  React.useEffect(() => {
    expandedPathsRef.current = expandedPaths;
  }, [expandedPaths]);

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
    async (handle: FileSystemDirectoryHandle) => {
      const tree = await getFileTree(handle, "", showHiddenFiles);
      setFiles(tree);
    },
    [showHiddenFiles],
  );

  const handleNewFileRef = React.useRef<() => void>(() => {});
  const handleOpenFolderRef = React.useRef<() => void>(() => {});
  const saveCurrentFolderStateRef = React.useRef<() => void>(() => {});

  const handleOpenFolder = React.useCallback(async () => {
    try {
      saveCurrentFolderStateRef.current();
      isSwitchingFolderRef.current = true;
      const handle = await (
        window as unknown as {
          showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
        }
      ).showDirectoryPicker();
      setRootHandle(handle);
      const folders = (await getRecentFolders()) ?? [];
      // Remove if already in list, then prepend so newest is first
      const filtered = folders.filter((f) => f.name !== handle.name);
      filtered.unshift(handle);
      await saveRecentFolders(filtered);
    } catch (err) {
      isSwitchingFolderRef.current = false;
      console.error("Failed to open folder", err);
    }
  }, []);

  React.useEffect(() => {
    handleOpenFolderRef.current = handleOpenFolder;
  }, [handleOpenFolder]);

  const handleReopenRecent = async () => {
    if (storedHandle) {
      const granted = await requestPermission(storedHandle);
      if (granted) {
        saveCurrentFolderStateRef.current();
        isSwitchingFolderRef.current = true;
        setRootHandle(storedHandle);
        const folders = (await getRecentFolders()) ?? [];
        const filtered = folders.filter((f) => f.name !== storedHandle.name);
        filtered.unshift(storedHandle);
        await saveRecentFolders(filtered);
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
      if (file.kind !== "file") return;

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

      setTabs((prev) => {
        if (prev.some((t) => t.relativePath === file.relativePath)) {
          return prev;
        }
        return [...prev, file];
      });
      setActivePath(file.relativePath);

      if (!isImageFile(file.name)) {
        await loadFileContent(
          file.handle as FileSystemFileHandle,
          lastModifiedRef,
          setProperties,
          setContentImmediate,
        );
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
  }, [headings]);

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
    const keepTab = tabs.find((t) => t.relativePath === keepPath);
    if (!keepTab) return;
    const activeWasClosed = activePath !== keepPath;
    setTabs([keepTab]);
    setActivePath(keepPath);
    if (activeWasClosed) {
      handleFileSelect(keepTab);
    }
  };

  const handleTabsCloseToRight = (fromPath: string) => {
    const fromIndex = tabs.findIndex((t) => t.relativePath === fromPath);
    if (fromIndex === -1) return;
    const activeInClosedRange =
      activePath !== null &&
      tabs.findIndex(
        (t, i) => t.relativePath === activePath && i > fromIndex,
      ) !== -1;
    const newTabs = tabs.slice(0, fromIndex + 1);
    setTabs(newTabs);
    if (activeInClosedRange && newTabs.length > 0) {
      const nextTab = newTabs[newTabs.length - 1];
      setActivePath(nextTab.relativePath);
      handleFileSelect(nextTab);
    }
  };

  const handleCopyFilePath = (path: string) => {
    navigator.clipboard.writeText(path);
  };

  const handleDeleteFile = React.useCallback(
    async (node: FileNode) => {
      if (!confirm(`Are you sure you want to delete "${node.name}"?`)) return;

      try {
        if (node.parentHandle) {
          await node.parentHandle.removeEntry(node.name, { recursive: true });
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

          if (activePathRef.current === node.relativePath) {
            setActivePath(node.relativePath.replace(node.name, newName));
          }
        } else {
          alert("Renaming is not supported in this browser.");
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
        const targetHandle =
          targetDirectory.handle as FileSystemDirectoryHandle;
        if (node.parentHandle) {
          const sameParent = await node.parentHandle.isSameEntry(targetHandle);
          if (sameParent) return;
        }

        // @ts-expect-error - move() is available in supporting browsers
        if (typeof node.handle.move === "function") {
          try {
            // @ts-expect-error - move() is available in supporting browsers
            await node.handle.move(targetHandle);

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
            console.error("Failed to move:", err);
            alert(
              node.kind === "directory"
                ? "Moving folders failed. They may need to be empty."
                : "Failed to move. Check for permissions or name conflicts.",
            );
          }
        } else {
          alert(
            node.kind === "directory"
              ? "Moving folders is not supported in this browser."
              : "Moving files is not supported in this browser.",
          );
        }
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

  React.useEffect(() => {
    handleNewFileRef.current = handleNewFile;
  }, [handleNewFile]);

  const handleCreateNote = React.useCallback(
    async (parentHandle: FileSystemDirectoryHandle) => {
      const fileName = prompt("Enter file name (e.g. notes.md)");
      if (!fileName) return;

      const name = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
      try {
        const fileHandle = await parentHandle.getFileHandle(name, {
          create: true,
        });
        if (rootHandle) await refreshFiles(rootHandle);
        const parentPath = (
          parentHandle as unknown as { relativePath?: string }
        ).relativePath;
        const relativePath = parentPath ? `${parentPath}/${name}` : name;
        const newNode: FileNode = {
          name,
          kind: "file",
          handle: fileHandle,
          relativePath,
          parentHandle,
        };
        handleFileSelect(newNode);
      } catch (err) {
        console.error("Failed to create file", err);
      }
    },
    [rootHandle, refreshFiles, handleFileSelect],
  );

  const handleCreateFolder = React.useCallback(
    async (parentHandle: FileSystemDirectoryHandle) => {
      const folderName = prompt("Enter folder name");
      if (!folderName) return;

      try {
        await parentHandle.getDirectoryHandle(folderName, { create: true });
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

      if (!currentFile || currentFile.handle.kind !== "file") return;

      const filePath = currentFile.relativePath;
      const fileHandle = currentFile.handle as FileSystemFileHandle;

      const existingTimeout = saveTimeoutRef.current.get(filePath);
      if (existingTimeout !== undefined) {
        window.clearTimeout(existingTimeout);
      }

      const timeoutId = window.setTimeout(() => {
        saveTimeoutRef.current.delete(filePath);
        const fmStr = serializeProperties(properties);
        const fullContent = fmStr + newContent;
        writeFile(fileHandle, fullContent)
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

      const fileHandle = await getFileHandleByPath(
        currentFile.parentHandle,
        path,
      );
      if (fileHandle) {
        const file = await fileHandle.getFile();
        return URL.createObjectURL(file);
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
        // biome-ignore lint/suspicious/noExplicitAny: icon type needs alignment
        icon: PlusSignIcon as any,
        shortcut: shortcuts["new-file"],
        perform: handleNewFile,
      },
      {
        id: "search",
        title: "Search Content",
        description: "Search in all markdown files",
        // biome-ignore lint/suspicious/noExplicitAny: icon type needs alignment
        icon: Search01Icon as any,
        shortcut: shortcuts.search,
        perform: handleSearchOpen,
      },
      {
        id: "command-bar",
        title: "Command Bar",
        description: "Open the command bar",
        // biome-ignore lint/suspicious/noExplicitAny: icon type needs alignment
        icon: ZapIcon as any,
        shortcut: shortcuts["command-bar"],
        perform: () => setIsCommandBarOpen(true),
      },
      {
        id: "graph-view",
        title: "Graph View",
        description: "Open graph view",
        // biome-ignore lint/suspicious/noExplicitAny: icon type needs alignment
        icon: Search01Icon as any,
        perform: openGraphViewTab,
      },
      {
        id: "toggle-sidebar",
        title: "Toggle Sidebar",
        description: "Show or hide the file sidebar",
        // biome-ignore lint/suspicious/noExplicitAny: icon type needs alignment
        icon: SidebarLeft01Icon as any,
        shortcut: shortcuts["toggle-sidebar"],
        perform: () => setIsSidebarOpen((prev) => !prev),
      },
      {
        id: "open-folder",
        title: "Open Folder",
        description: "Open a different folder",
        // biome-ignore lint/suspicious/noExplicitAny: icon type needs alignment
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
      setIsCommandBarOpen,
      setIsSidebarOpen,
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
    if (!rootHandle || isSwitchingFolderRef.current) return;
    localStorage.setItem(
      getStorageKey(SIDEBAR_OPEN_STORAGE_KEY_BASE, rootHandle.name),
      String(isSidebarOpen),
    );
  }, [isSidebarOpen, rootHandle]);

  React.useEffect(() => {
    if (!rootHandle || isSwitchingFolderRef.current) return;
    localStorage.setItem(
      getStorageKey(SIDEBAR_EXPANDED_PATHS_KEY_BASE, rootHandle.name),
      JSON.stringify([...expandedPaths]),
    );
  }, [expandedPaths, rootHandle]);

  React.useEffect(() => {
    if (!rootHandle || isSwitchingFolderRef.current) return;
    localStorage.setItem(
      getStorageKey(TABS_STORAGE_KEY_BASE, rootHandle.name),
      JSON.stringify(tabs.map((t) => t.relativePath)),
    );
  }, [tabs, rootHandle]);

  React.useEffect(() => {
    if (!rootHandle || !activePath || isSwitchingFolderRef.current) return;
    localStorage.setItem(
      getStorageKey(ACTIVE_PATH_STORAGE_KEY_BASE, rootHandle.name),
      activePath,
    );
  }, [activePath, rootHandle]);

  const saveCurrentFolderState = React.useCallback(() => {
    if (!rootHandleRef.current) return;
    localStorage.setItem(
      getStorageKey(TABS_STORAGE_KEY_BASE, rootHandleRef.current.name),
      JSON.stringify(tabsRef.current.map((t: FileNode) => t.relativePath)),
    );
    if (activePathRef.current) {
      localStorage.setItem(
        getStorageKey(ACTIVE_PATH_STORAGE_KEY_BASE, rootHandleRef.current.name),
        activePathRef.current,
      );
    }
    localStorage.setItem(
      getStorageKey(SIDEBAR_OPEN_STORAGE_KEY_BASE, rootHandleRef.current.name),
      String(isSidebarOpenRef.current),
    );
    localStorage.setItem(
      getStorageKey(
        SIDEBAR_EXPANDED_PATHS_KEY_BASE,
        rootHandleRef.current.name,
      ),
      JSON.stringify([...expandedPathsRef.current]),
    );
  }, []);

  React.useEffect(() => {
    saveCurrentFolderStateRef.current = saveCurrentFolderState;
  }, [saveCurrentFolderState]);

  // Load folder-specific state when rootHandle changes
  React.useEffect(() => {
    if (!rootHandle) return;

    const generation = ++loadGenerationRef.current;

    const loadFolderState = async () => {
      try {
        const folderName = rootHandle.name;
        const getKey = (base: string) => getStorageKey(base, folderName);

        // Restore sidebar state
        const savedSidebarOpen = localStorage.getItem(
          getKey(SIDEBAR_OPEN_STORAGE_KEY_BASE),
        );
        setIsSidebarOpen(
          savedSidebarOpen !== null ? savedSidebarOpen === "true" : true,
        );

        // Restore expanded paths
        const savedExpandedPaths = localStorage.getItem(
          getKey(SIDEBAR_EXPANDED_PATHS_KEY_BASE),
        );
        try {
          setExpandedPaths(
            savedExpandedPaths
              ? new Set(JSON.parse(savedExpandedPaths))
              : new Set(),
          );
        } catch {
          setExpandedPaths(new Set());
        }

        // Build file tree
        const tree = await getFileTree(rootHandle, "", showHiddenFiles);
        if (loadGenerationRef.current !== generation) return;
        setFiles(tree);

        // Restore tabs
        const savedTabs = localStorage.getItem(getKey(TABS_STORAGE_KEY_BASE));
        if (!savedTabs) {
          setTabs([]);
          setActivePath(null);
          setContentImmediate("");
          setProperties([]);
          return;
        }

        const paths: string[] = JSON.parse(savedTabs);
        const restoredTabs = paths.reduce<FileNode[]>((acc, path) => {
          const node =
            path === GRAPH_TAB_PATH
              ? createGraphTabNode(rootHandle)
              : findNodeByPath(tree, path);
          if (node) {
            acc.push(node);
          }
          return acc;
        }, []);
        if (loadGenerationRef.current !== generation) return;
        setTabs(restoredTabs);

        // Restore active tab
        const savedActive = localStorage.getItem(
          getKey(ACTIVE_PATH_STORAGE_KEY_BASE),
        );
        const activeNode = savedActive
          ? (restoredTabs.find((t) => t.relativePath === savedActive) ?? null)
          : null;

        if (!activeNode) {
          setActivePath(null);
          setContentImmediate("");
          setProperties([]);
          return;
        }

        if (loadGenerationRef.current !== generation) return;
        setActivePath(activeNode.relativePath);

        if (
          activeNode.relativePath === GRAPH_TAB_PATH ||
          isImageFile(activeNode.name)
        ) {
          setContentImmediate("");
          setProperties([]);
        } else {
          await loadFileContent(
            activeNode.handle as FileSystemFileHandle,
            lastModifiedRef,
            setProperties,
            setContentImmediate,
          );
        }
      } catch (e) {
        console.error("Failed to restore folder state", e);
      } finally {
        if (loadGenerationRef.current === generation) {
          isSwitchingFolderRef.current = false;
        }
      }
    };

    void loadFolderState();

    return () => {
      ++loadGenerationRef.current;
    };
  }, [rootHandle, setContentImmediate, showHiddenFiles]);

  // Initial app setup - find a folder to open
  React.useEffect(() => {
    const init = async () => {
      const recents = await getRecentFolders();
      const recent = recents ? recents[0] : null;

      if (recent) {
        setRootHandle(recent);
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

  const currentIsImage = currentFile ? isImageFile(currentFile.name) : false;
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
              <Popover
                open={isFolderSwitcherOpen}
                onOpenChange={setIsFolderSwitcherOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    className="h-8 text-muted-foreground"
                  >
                    {rootHandle.name}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-0" align="end">
                  <FolderSwitcher
                    currentRoot={rootHandle}
                    onFolderSelect={async (handle) => {
                      try {
                        saveCurrentFolderState();
                        isSwitchingFolderRef.current = true;
                        setRootHandle(handle);
                      } catch (err) {
                        isSwitchingFolderRef.current = false;
                        console.error("Failed to switch folder", err);
                      }
                    }}
                    onOpenFolder={handleOpenFolder}
                    isOpen={isFolderSwitcherOpen}
                  />
                </PopoverContent>
              </Popover>
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
                    if (currentFile && currentFile.handle.kind === "file") {
                      const fileHandle =
                        currentFile.handle as FileSystemFileHandle;
                      writeFile(fileHandle, fullContent)
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

              if (isImageFile(tab.name)) {
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
