import {
	Cancel01Icon,
	CheckmarkCircle02Icon,
	Delete01Icon,
	File01Icon,
	Folder01Icon,
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
	currentFile?: FileNode;
	headings?: { level: number; text: string; index: number }[];
	onHeadingClick?: (index: number) => void;
	onSearchOpen: () => void;
}

export function Sidebar({
	files,
	onFileSelect,
	onDelete,
	onRename,
	currentFile,
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
					currentFile={currentFile}
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

function FileTree({
	nodes,
	onFileSelect,
	onDelete,
	onRename,
	currentFile,
	level = 0,
}: {
	nodes: FileNode[];
	onFileSelect: (file: FileNode) => void;
	onDelete?: (node: FileNode) => void;
	onRename?: (node: FileNode, newName: string) => Promise<void>;
	currentFile?: FileNode;
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
					currentFile={currentFile}
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

function Actions({
	isSelected,
	onRename,
	onDelete,
}: {
	isSelected: boolean;
	onRename: () => void;
	onDelete: () => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				className={cn(
					"ml-auto flex rounded-md p-0.5 opacity-0 transition-opacity hover:bg-secondary focus-visible:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100 data-open:opacity-100",
					isSelected &&
						"text-secondary-foreground hover:bg-secondary-foreground/20",
				)}
				onClick={(e) => e.stopPropagation()}
			>
				<HugeiconsIcon icon={MoreVerticalIcon} className="h-3.5 w-3.5" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
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
}

function FileTreeNode({
	node,
	onFileSelect,
	onDelete,
	onRename,
	currentFile,
	level,
}: {
	node: FileNode;
	onFileSelect: (file: FileNode) => void;
	onDelete?: (node: FileNode) => void;
	onRename?: (node: FileNode, newName: string) => Promise<void>;
	currentFile?: FileNode;
	level: number;
}) {
	const [isOpen, setIsOpen] = React.useState(false);
	const [isRenaming, setIsRenaming] = React.useState(false);
	const isSelected = currentFile?.relativePath === node.relativePath;

	const handleRenameSubmit = async (newName: string) => {
		if (newName && newName !== node.name && onRename) {
			await onRename(node, newName);
		}
		setIsRenaming(false);
	};

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
				onClick={() => {
					if (isRenaming) return;
					if (node.kind === "directory") {
						setIsOpen(!isOpen);
					} else {
						onFileSelect(node);
					}
				}}
				onDoubleClick={() => !isRenaming && setIsRenaming(true)}
				className="flex flex-1 items-center gap-2 overflow-hidden text-left"
			>
				<HugeiconsIcon
					icon={node.kind === "directory" ? Folder01Icon : File01Icon}
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
					onRename={() => setIsRenaming(true)}
					onDelete={() => onDelete?.(node)}
				/>
			)}
		</div>
	);

	return (
		<div className="flex flex-col">
			<ContextMenu>
				<ContextMenuTrigger render={nodeContent} />
				<ContextMenuContent>
					<ContextMenuItem onClick={() => setIsRenaming(true)}>
						<HugeiconsIcon
							icon={PencilEdit01Icon}
							className="mr-2 h-3.5 w-3.5"
						/>
						<span>Rename</span>
					</ContextMenuItem>
					<ContextMenuItem
						variant="destructive"
						onClick={() => onDelete?.(node)}
					>
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
					currentFile={currentFile}
					level={level + 1}
				/>
			)}
		</div>
	);
}
