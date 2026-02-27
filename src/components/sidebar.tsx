import {
	Cancel01Icon,
	CheckmarkCircle02Icon,
	Delete01Icon,
	File01Icon,
	FileAddIcon,
	Folder01Icon,
	Folder03Icon,
	FolderAddIcon,
	Image01Icon,
	MoreVerticalIcon,
	PencilEdit01Icon,
	Search01Icon,
	Settings01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import * as React from "react";

import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FileNode } from "@/lib/fs";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

interface SidebarProps {
	files: FileNode[];
	onFileSelect: (file: FileNode) => void;
	onDelete?: (node: FileNode) => void;
	onRename?: (node: FileNode, newName: string) => Promise<void>;
	onMove?: (node: FileNode, targetDirectory: FileNode) => Promise<void>;
	onCreateFolder?: (parentHandle: FileSystemDirectoryHandle) => void;
	onCreateNote?: (parentHandle: FileSystemDirectoryHandle) => void;
	activePath?: string | null;
	headings?: { level: number; text: string; index: number }[];
	onHeadingClick?: (index: number) => void;
	onSearchOpen: () => void;
}

function SidebarComponent({
	files,
	onFileSelect,
	onDelete,
	onRename,
	onMove,
	onCreateFolder,
	onCreateNote,
	activePath,
	onSearchOpen,
}: SidebarProps) {
	const [draggedPath, setDraggedPath] = React.useState<string | null>(null);
	const [dropTargetPath, setDropTargetPath] = React.useState<string | null>(
		null,
	);
	const draggedNodeRef = React.useRef<FileNode | null>(null);

	const handleDragStart = React.useCallback((node: FileNode) => {
		draggedNodeRef.current = node;
		setDraggedPath(node.relativePath);
	}, []);

	const handleDragEnd = React.useCallback(() => {
		draggedNodeRef.current = null;
		setDraggedPath(null);
		setDropTargetPath(null);
	}, []);

	const handleDropTargetChange = React.useCallback((path: string | null) => {
		setDropTargetPath(path);
	}, []);

	const handleNodeDrop = React.useCallback(
		async (targetDirectory: FileNode) => {
			const draggedNode = draggedNodeRef.current;
			if (!draggedNode || !onMove) return;

			if (targetDirectory.kind !== "directory") return;
			if (draggedNode.relativePath === targetDirectory.relativePath) return;
			if (
				draggedNode.kind === "directory" &&
				targetDirectory.relativePath.startsWith(`${draggedNode.relativePath}/`)
			) {
				return;
			}

			await onMove(draggedNode, targetDirectory);
		},
		[onMove],
	);

	return (
		<div className="flex h-full w-64 flex-col border-r bg-secondary/30">
			<div className="px-2 pt-2">
				<Button
					type="button"
					onClick={onSearchOpen}
					variant="outline"
					size="lg"
					className="w-full justify-start"
				>
					<HugeiconsIcon icon={Search01Icon} className="h-4 w-4" />
					<span>Search</span>
				</Button>
			</div>
			<div className="flex-1 overflow-auto p-2">
				<FileTree
					nodes={files}
					onFileSelect={onFileSelect}
					onDelete={onDelete}
					onRename={onRename}
					onMove={handleNodeDrop}
					onCreateFolder={onCreateFolder}
					onCreateNote={onCreateNote}
					activePath={activePath}
					draggedPath={draggedPath}
					dropTargetPath={dropTargetPath}
					onDragStart={handleDragStart}
					onDragEnd={handleDragEnd}
					onDropTargetChange={handleDropTargetChange}
					getDraggedNode={() => draggedNodeRef.current}
				/>
			</div>

			<div className="border-t p-2">
				<Link to="/settings">
					<button
						type="button"
						className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-secondary hover:text-foreground"
					>
						<HugeiconsIcon icon={Settings01Icon} className="h-4 w-4" />
						<span>Settings</span>
					</button>
				</Link>
			</div>
		</div>
	);
}

export const Sidebar = React.memo(SidebarComponent);
Sidebar.displayName = "Sidebar";

function FileTree({
	nodes,
	onFileSelect,
	onDelete,
	onRename,
	onMove,
	onCreateFolder,
	onCreateNote,
	activePath,
	draggedPath,
	dropTargetPath,
	onDragStart,
	onDragEnd,
	onDropTargetChange,
	getDraggedNode,
	level = 0,
}: {
	nodes: FileNode[];
	onFileSelect: (file: FileNode) => void;
	onDelete?: (node: FileNode) => void;
	onRename?: (node: FileNode, newName: string) => Promise<void>;
	onMove?: (targetDirectory: FileNode) => Promise<void>;
	onCreateFolder?: (parentHandle: FileSystemDirectoryHandle) => void;
	onCreateNote?: (parentHandle: FileSystemDirectoryHandle) => void;
	activePath?: string | null;
	draggedPath?: string | null;
	dropTargetPath?: string | null;
	onDragStart?: (node: FileNode) => void;
	onDragEnd?: () => void;
	onDropTargetChange?: (path: string | null) => void;
	getDraggedNode?: () => FileNode | null;
	level?: number;
}) {
	const flatNodes = React.useMemo(() => {
		const result: { node: FileNode; index: number }[] = [];
		const flatten = (items: FileNode[], idx: number) => {
			for (const item of items) {
				result.push({ node: item, index: idx++ });
				if (item.kind === "directory" && item.children) {
					idx = flatten(item.children, idx);
				}
			}
			return idx;
		};
		flatten(nodes, 0);
		return result;
	}, [nodes]);

	const flatIndexRef = React.useRef<Map<string, number>>(new Map());
	React.useEffect(() => {
		const map = new Map<string, number>();
		flatNodes.forEach(({ node }, idx) => {
			map.set(node.relativePath, idx);
		});
		flatIndexRef.current = map;
	}, [flatNodes]);

	const getParentDirectory = React.useCallback(
		(node: FileNode): FileNode | null => {
			if (!node.parentHandle) return null;
			const parentPath = node.relativePath.slice(
				0,
				node.relativePath.length - node.name.length - 1,
			);
			const parentNode = flatNodes.find(
				(n) =>
					n.node.relativePath === parentPath && n.node.kind === "directory",
			);
			return parentNode?.node || null;
		},
		[flatNodes],
	);

	const dropIndexRef = React.useRef<number | null>(null);
	const handleFileDrop = React.useCallback(
		async (targetIndex: number) => {
			const draggedNode = getDraggedNode ? getDraggedNode() : null;
			if (!draggedNode || !onMove) return;

			const targetEntry = flatNodes[targetIndex];
			if (!targetEntry) return;

			const targetNode = targetEntry.node;
			if (targetNode.kind === "directory") {
				await onMove(targetNode);
			} else {
				const parentDir = getParentDirectory(targetNode);
				if (parentDir) {
					await onMove(parentDir);
				}
			}
		},
		[flatNodes, getParentDirectory, getDraggedNode, onMove],
	);

	const handleDragOverFile = React.useCallback(
		(e: React.DragEvent, index: number) => {
			if (draggedPath === null) return;
			e.preventDefault();
			e.dataTransfer.dropEffect = "move";
			const rect = e.currentTarget.getBoundingClientRect();
			const midpoint = rect.top + rect.height / 2;
			let newDropIndex: number;
			if (e.clientY < midpoint) {
				newDropIndex = index;
			} else {
				newDropIndex = index + 1;
			}
			if (newDropIndex !== dropIndexRef.current) {
				dropIndexRef.current = newDropIndex;
				onDropTargetChange?.(`__drop_index_${newDropIndex}`);
			}
		},
		[draggedPath, onDropTargetChange],
	);

	const handleDragLeaveFile = React.useCallback(
		(e: React.DragEvent) => {
			if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
				dropIndexRef.current = null;
				onDropTargetChange?.(null);
			}
		},
		[onDropTargetChange],
	);

	const handleFileDropWrapper = React.useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			const targetIndex = dropIndexRef.current;
			if (targetIndex !== null) {
				void handleFileDrop(targetIndex);
			}
			dropIndexRef.current = null;
			onDropTargetChange?.(null);
			onDragEnd?.();
		},
		[handleFileDrop, onDropTargetChange, onDragEnd],
	);

	const isDropBetweenFiles =
		draggedPath !== null && dropTargetPath?.startsWith("__drop_index_");

	return (
		<div className="relative flex flex-col gap-0.5">
			{nodes.map((node) => {
				const flatIdx = flatIndexRef.current.get(node.relativePath) ?? 0;
				const isFile = node.kind === "file";
				const currentDropIndex = dropTargetPath
					? Number.parseInt(dropTargetPath.replace("__drop_index_", ""), 10)
					: null;
				const isDropPositionBefore =
					isFile &&
					isDropBetweenFiles &&
					currentDropIndex === flatIdx &&
					draggedPath !== node.relativePath;
				const isDropPositionAfter =
					isFile &&
					isDropBetweenFiles &&
					currentDropIndex === flatIdx + 1 &&
					draggedPath !== node.relativePath;

				return (
					<React.Fragment key={node.relativePath}>
						{isFile ? (
							<div
								role="none"
								className="relative"
								onDragOver={(e) => handleDragOverFile(e, flatIdx)}
								onDragLeave={handleDragLeaveFile}
								onDrop={handleFileDropWrapper}
							>
								{isDropPositionBefore && (
									<div className="absolute -top-px left-0 right-0 h-0.5 bg-primary" />
								)}
								<FileTreeNode
									node={node}
									onFileSelect={onFileSelect}
									onDelete={onDelete}
									onRename={onRename}
									onMove={onMove}
									onCreateFolder={onCreateFolder}
									onCreateNote={onCreateNote}
									activePath={activePath}
									draggedPath={draggedPath}
									dropTargetPath={dropTargetPath}
									onDragStart={onDragStart}
									onDragEnd={onDragEnd}
									onDropTargetChange={onDropTargetChange}
									level={level}
								/>
								{isDropPositionAfter && (
									<div className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary" />
								)}
							</div>
						) : (
							<FileTreeNode
								node={node}
								onFileSelect={onFileSelect}
								onDelete={onDelete}
								onRename={onRename}
								onMove={onMove}
								onCreateFolder={onCreateFolder}
								onCreateNote={onCreateNote}
								activePath={activePath}
								draggedPath={draggedPath}
								dropTargetPath={dropTargetPath}
								onDragStart={onDragStart}
								onDragEnd={onDragEnd}
								onDropTargetChange={onDropTargetChange}
								level={level}
							/>
						)}
					</React.Fragment>
				);
			})}
		</div>
	);
}

function RenameInput({
	initialValue,
	onSave,
	onCancel,
}: {
	initialValue: string;
	onSave: (newName: string) => void;
	onCancel: () => void;
}) {
	const [value, setValue] = React.useState(initialValue);

	return (
		<div className="flex flex-1 items-center gap-1 overflow-hidden">
			<input
				ref={(node) => {
					if (node) {
						node.focus();
						node.select();
					}
				}}
				type="text"
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") onSave(value);
					if (e.key === "Escape") onCancel();
				}}
				onBlur={() => onSave(value)}
				onClick={(e) => e.stopPropagation()}
				className="min-w-0 flex-1 px-1 text-sm outline-none"
			/>
			<div className="flex shrink-0 items-center">
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onSave(value);
					}}
					className="rounded-md p-0.5 text-primary hover:bg-primary/10"
					title="Confirm"
				>
					<HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-3.5 w-3.5" />
				</button>
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onCancel();
					}}
					className="rounded-md p-0.5 text-destructive hover:bg-destructive/10"
					title="Cancel"
				>
					<HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5" />
				</button>
			</div>
		</div>
	);
}

const Actions = React.memo(function Actions({
	isSelected,
	isDirectory,
	onRename,
	onDelete,
	onCreateNote,
	onCreateFolder,
}: {
	isSelected: boolean;
	isDirectory: boolean;
	onRename: () => void;
	onDelete: () => void;
	onCreateNote?: () => void;
	onCreateFolder?: () => void;
}) {
	const handleTriggerClick = React.useCallback((e: React.MouseEvent) => {
		e.stopPropagation();
	}, []);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				className={cn(
					"ml-auto flex rounded-md p-0.5 opacity-0 transition-opacity hover:bg-secondary focus-visible:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100 data-open:opacity-100",
					isSelected &&
						"text-secondary-foreground hover:bg-secondary-foreground/20",
				)}
				onClick={handleTriggerClick}
			>
				<HugeiconsIcon icon={MoreVerticalIcon} className="h-3.5 w-3.5" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{isDirectory && (
					<>
						<DropdownMenuItem onClick={onCreateNote}>
							<HugeiconsIcon icon={FileAddIcon} className="mr-2 h-3.5 w-3.5" />
							<span>New Note</span>
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onCreateFolder}>
							<HugeiconsIcon
								icon={FolderAddIcon}
								className="mr-2 h-3.5 w-3.5"
							/>
							<span>New Folder</span>
						</DropdownMenuItem>
					</>
				)}
				<DropdownMenuItem onClick={onRename}>
					<HugeiconsIcon icon={PencilEdit01Icon} className="mr-2 h-3.5 w-3.5" />
					<span>Rename</span>
				</DropdownMenuItem>
				<DropdownMenuItem variant="destructive" onClick={onDelete}>
					<HugeiconsIcon icon={Delete01Icon} className="mr-2 h-3.5 w-3.5" />
					<span>Delete</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
});

Actions.displayName = "Actions";

type FileTreeNodeProps = {
	node: FileNode;
	onFileSelect: (file: FileNode) => void;
	onDelete?: (node: FileNode) => void;
	onRename?: (node: FileNode, newName: string) => Promise<void>;
	onMove?: (targetDirectory: FileNode) => Promise<void>;
	onCreateFolder?: (parentHandle: FileSystemDirectoryHandle) => void;
	onCreateNote?: (parentHandle: FileSystemDirectoryHandle) => void;
	activePath?: string | null;
	draggedPath?: string | null;
	dropTargetPath?: string | null;
	onDragStart?: (node: FileNode) => void;
	onDragEnd?: () => void;
	onDropTargetChange?: (path: string | null) => void;
	level: number;
};

function FileTreeNodeComponent({
	node,
	onFileSelect,
	onDelete,
	onRename,
	onMove,
	onCreateFolder,
	onCreateNote,
	activePath,
	draggedPath,
	dropTargetPath,
	onDragStart,
	onDragEnd,
	onDropTargetChange,
	level,
}: FileTreeNodeProps) {
	const [isOpen, setIsOpen] = React.useState(false);
	const [isRenaming, setIsRenaming] = React.useState(false);
	const isSelected = activePath === node.relativePath;

	const handleToggleOrSelect = React.useCallback(() => {
		if (isRenaming) return;
		if (node.kind === "directory") {
			setIsOpen((prev) => !prev);
		} else {
			onFileSelect(node);
		}
	}, [isRenaming, node, onFileSelect]);

	const handleStartRenaming = React.useCallback(() => {
		if (!isRenaming) {
			setIsRenaming(true);
		}
	}, [isRenaming]);

	const handleDelete = React.useCallback(() => {
		onDelete?.(node);
	}, [node, onDelete]);

	const handleCreateNote = React.useCallback(() => {
		onCreateNote?.(node.handle as FileSystemDirectoryHandle);
	}, [node, onCreateNote]);

	const handleCreateFolder = React.useCallback(() => {
		onCreateFolder?.(node.handle as FileSystemDirectoryHandle);
	}, [node, onCreateFolder]);

	const handleRenameSubmit = async (newName: string) => {
		if (newName && newName !== node.name && onRename) {
			await onRename(node, newName);
		}
		setIsRenaming(false);
	};

	const isImage = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"].some(
		(ext) => node.name.toLowerCase().endsWith(ext),
	);

	const dropTargetDirectory = React.useMemo(() => {
		if (draggedPath === null || draggedPath === node.relativePath) return null;
		if (node.relativePath.startsWith(`${draggedPath}/`)) return null;
		if (node.kind === "directory") return node;
		if (node.parentHandle) {
			return {
				...node,
				kind: "directory" as const,
				handle: node.parentHandle,
				relativePath: node.relativePath.slice(
					0,
					node.relativePath.length - node.name.length - 1,
				),
			};
		}
		return null;
	}, [draggedPath, node]);

	const isDropTarget = dropTargetPath === node.relativePath;

	// eslint-disable-next-line jsx-a11y/no-static-element-interactions
	const nodeContent = (
		<div
			role="button"
			tabIndex={0}
			className={cn(
				"group flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors",
				isSelected
					? "bg-secondary text-secondary-foreground"
					: "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
				draggedPath === node.relativePath && "opacity-50",
				node.kind === "directory" &&
					dropTargetDirectory &&
					isDropTarget &&
					"bg-primary/10 text-foreground",
				"focus-within:outline-none",
				node.kind === "directory" && "text-muted-foreground",
			)}
			style={{ paddingLeft: `${level * 12 + 8}px` }}
			onDragOver={
				node.kind === "directory"
					? (e) => {
							if (!dropTargetDirectory) return;
							e.preventDefault();
							e.dataTransfer.dropEffect = "move";
							onDropTargetChange?.(node.relativePath);
						}
					: undefined
			}
			onDragLeave={
				node.kind === "directory"
					? (e) => {
							if (!dropTargetDirectory) return;
							if (e.currentTarget.contains(e.relatedTarget as Node | null))
								return;
							onDropTargetChange?.(null);
						}
					: undefined
			}
			onDrop={
				node.kind === "directory"
					? (e) => {
							if (!dropTargetDirectory || !onMove) return;
							e.preventDefault();
							onDropTargetChange?.(null);
							void onMove(dropTargetDirectory);
							onDragEnd?.();
						}
					: undefined
			}
		>
			<button
				type="button"
				onClick={handleToggleOrSelect}
				onDoubleClick={handleStartRenaming}
				draggable={!isRenaming}
				onDragStart={(e) => {
					e.stopPropagation();
					e.dataTransfer.effectAllowed = "move";
					e.dataTransfer.setData("text/plain", node.relativePath);
					onDragStart?.(node);
				}}
				onDragEnd={() => {
					onDragEnd?.();
				}}
				onDrop={
					node.kind === "file" && dropTargetDirectory
						? (e) => {
								e.preventDefault();
								e.stopPropagation();
								void onMove?.(dropTargetDirectory);
								onDragEnd?.();
							}
						: undefined
				}
				className="flex flex-1 items-center gap-2 overflow-hidden text-left"
			>
				<HugeiconsIcon
					icon={
						node.kind === "directory"
							? isOpen
								? Folder03Icon
								: Folder01Icon
							: isImage
								? Image01Icon
								: File01Icon
					}
					className={cn(
						"h-4 w-4 shrink-0",
						isSelected
							? "text-secondary-foreground"
							: "text-muted-foreground group-hover:text-foreground",
						node.kind === "directory" && isOpen && "rotate-0",
					)}
				/>
				{isRenaming ? (
					<RenameInput
						initialValue={node.name}
						onSave={handleRenameSubmit}
						onCancel={() => setIsRenaming(false)}
					/>
				) : (
					<span className="truncate">{node.name}</span>
				)}
			</button>
			{!isRenaming && (
				<Actions
					isSelected={isSelected}
					isDirectory={node.kind === "directory"}
					onRename={handleStartRenaming}
					onDelete={handleDelete}
					onCreateNote={handleCreateNote}
					onCreateFolder={handleCreateFolder}
				/>
			)}
		</div>
	);

	return (
		<div className="flex flex-col">
			<ContextMenu>
				<ContextMenuTrigger render={nodeContent} />
				<ContextMenuContent>
					{node.kind === "directory" && (
						<>
							<ContextMenuItem onClick={handleCreateNote}>
								<HugeiconsIcon
									icon={FileAddIcon}
									className="mr-2 h-3.5 w-3.5"
								/>
								<span>New Note</span>
							</ContextMenuItem>
							<ContextMenuItem onClick={handleCreateFolder}>
								<HugeiconsIcon
									icon={FolderAddIcon}
									className="mr-2 h-3.5 w-3.5"
								/>
								<span>New Folder</span>
							</ContextMenuItem>
						</>
					)}
					<ContextMenuItem onClick={handleStartRenaming}>
						<HugeiconsIcon
							icon={PencilEdit01Icon}
							className="mr-2 h-3.5 w-3.5"
						/>
						<span>Rename</span>
					</ContextMenuItem>
					<ContextMenuItem variant="destructive" onClick={handleDelete}>
						<HugeiconsIcon icon={Delete01Icon} className="mr-2 h-3.5 w-3.5" />
						<span>Delete</span>
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>
			{node.kind === "directory" && isOpen && node.children && (
				<FileTree
					nodes={node.children}
					onFileSelect={onFileSelect}
					onDelete={onDelete}
					onRename={onRename}
					onMove={onMove}
					onCreateFolder={onCreateFolder}
					onCreateNote={onCreateNote}
					activePath={activePath}
					draggedPath={draggedPath}
					dropTargetPath={dropTargetPath}
					onDragStart={onDragStart}
					onDragEnd={onDragEnd}
					onDropTargetChange={onDropTargetChange}
					level={level + 1}
				/>
			)}
		</div>
	);
}

function areFileTreeNodePropsEqual(
	prev: FileTreeNodeProps,
	next: FileTreeNodeProps,
) {
	const prevSelected = prev.activePath === prev.node.relativePath;
	const nextSelected = next.activePath === next.node.relativePath;

	return (
		prev.node === next.node &&
		prev.level === next.level &&
		prev.onFileSelect === next.onFileSelect &&
		prev.onDelete === next.onDelete &&
		prev.onRename === next.onRename &&
		prev.onMove === next.onMove &&
		prev.onCreateFolder === next.onCreateFolder &&
		prev.onCreateNote === next.onCreateNote &&
		prev.draggedPath === next.draggedPath &&
		prev.dropTargetPath === next.dropTargetPath &&
		prev.onDragStart === next.onDragStart &&
		prev.onDragEnd === next.onDragEnd &&
		prev.onDropTargetChange === next.onDropTargetChange &&
		prevSelected === nextSelected
	);
}

const FileTreeNode = React.memo(
	FileTreeNodeComponent,
	areFileTreeNodePropsEqual,
);
FileTreeNode.displayName = "FileTreeNode";
