import {
	Cancel01Icon,
	CheckmarkCircle02Icon,
	Delete01Icon,
	File01Icon,
	Folder01Icon,
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
	onCreateFolder,
	onCreateNote,
	activePath,
	onSearchOpen,
}: SidebarProps) {
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
					onCreateFolder={onCreateFolder}
					onCreateNote={onCreateNote}
					activePath={activePath}
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
	onCreateFolder,
	onCreateNote,
	activePath,
	level = 0,
}: {
	nodes: FileNode[];
	onFileSelect: (file: FileNode) => void;
	onDelete?: (node: FileNode) => void;
	onRename?: (node: FileNode, newName: string) => Promise<void>;
	onCreateFolder?: (parentHandle: FileSystemDirectoryHandle) => void;
	onCreateNote?: (parentHandle: FileSystemDirectoryHandle) => void;
	activePath?: string | null;
	level?: number;
}) {
	return (
		<div className="flex flex-col gap-0.5">
			{nodes.map((node) => (
				<FileTreeNode
					key={node.relativePath}
					node={node}
					onFileSelect={onFileSelect}
					onDelete={onDelete}
					onRename={onRename}
					onCreateFolder={onCreateFolder}
					onCreateNote={onCreateNote}
					activePath={activePath}
					level={level}
				/>
			))}
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
							<HugeiconsIcon icon={File01Icon} className="mr-2 h-3.5 w-3.5" />
							<span>New Note</span>
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onCreateFolder}>
							<HugeiconsIcon icon={Folder01Icon} className="mr-2 h-3.5 w-3.5" />
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
	onCreateFolder?: (parentHandle: FileSystemDirectoryHandle) => void;
	onCreateNote?: (parentHandle: FileSystemDirectoryHandle) => void;
	activePath?: string | null;
	level: number;
};

function FileTreeNodeComponent({
	node,
	onFileSelect,
	onDelete,
	onRename,
	onCreateFolder,
	onCreateNote,
	activePath,
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

	const nodeContent = (
		<div
			className={cn(
				"group flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors",
				isSelected
					? "bg-secondary text-secondary-foreground"
					: "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
				"focus-within:outline-none",
				node.kind === "directory" && "text-muted-foreground",
			)}
			style={{ paddingLeft: `${level * 12 + 8}px` }}
		>
			<button
				type="button"
				onClick={handleToggleOrSelect}
				onDoubleClick={handleStartRenaming}
				className="flex flex-1 items-center gap-2 overflow-hidden text-left"
			>
				<HugeiconsIcon
					icon={
						node.kind === "directory"
							? Folder01Icon
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
								<HugeiconsIcon icon={File01Icon} className="mr-2 h-3.5 w-3.5" />
								<span>New Note</span>
							</ContextMenuItem>
							<ContextMenuItem onClick={handleCreateFolder}>
								<HugeiconsIcon
									icon={Folder01Icon}
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
					onCreateFolder={onCreateFolder}
					onCreateNote={onCreateNote}
					activePath={activePath}
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
		prev.onCreateFolder === next.onCreateFolder &&
		prev.onCreateNote === next.onCreateNote &&
		prevSelected === nextSelected
	);
}

const FileTreeNode = React.memo(
	FileTreeNodeComponent,
	areFileTreeNodePropsEqual,
);
FileTreeNode.displayName = "FileTreeNode";
