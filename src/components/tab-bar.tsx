import {
	Cancel01Icon,
	Copy01Icon,
	File01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as React from "react";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { FileNode } from "@/lib/fs";
import { cn } from "@/lib/utils";

interface TabBarProps {
	tabs: FileNode[];
	activePath: string | null;
	onTabSelect: (file: FileNode) => void;
	onTabClose: (path: string) => void;
	onTabsCloseOther?: (keepPath: string) => void;
	onTabsCloseToRight?: (fromPath: string) => void;
	onTabsCloseAll?: () => void;
	onTabsReorder?: (newTabs: FileNode[]) => void;
	onCopyFilePath?: (path: string) => void;
	left?: React.ReactNode;
	right?: React.ReactNode;
}

export function TabBar({
	tabs,
	activePath,
	onTabSelect,
	onTabClose,
	onTabsCloseOther,
	onTabsCloseToRight,
	onTabsCloseAll,
	onTabsReorder,
	onCopyFilePath,
	left,
	right,
}: TabBarProps) {
	const scrollRef = React.useRef<HTMLDivElement>(null);
	const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
	const [dropIndex, setDropIndex] = React.useState<number | null>(null);

	const handleDragStart = (e: React.DragEvent, index: number) => {
		setDraggedIndex(index);
		e.dataTransfer.effectAllowed = "move";
		if (e.currentTarget instanceof HTMLElement) {
			e.currentTarget.style.opacity = "0.5";
		}
	};

	const handleDragEnd = (e: React.DragEvent) => {
		setDraggedIndex(null);
		setDropIndex(null);
		if (e.currentTarget instanceof HTMLElement) {
			e.currentTarget.style.opacity = "1";
		}
	};

	const handleDragOver = (e: React.DragEvent, index: number) => {
		e.preventDefault();
		const rect = e.currentTarget.getBoundingClientRect();
		const midpoint = rect.left + rect.width / 2;
		const newDropIndex = e.clientX < midpoint ? index : index + 1;

		if (newDropIndex !== dropIndex) {
			setDropIndex(newDropIndex);
		}
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		if (
			draggedIndex === null ||
			dropIndex === null ||
			draggedIndex === dropIndex ||
			draggedIndex === dropIndex - 1
		) {
			setDropIndex(null);
			return;
		}

		const newTabs = [...tabs];
		const [draggedTab] = newTabs.splice(draggedIndex, 1);
		const adjustedDropIndex =
			draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
		newTabs.splice(adjustedDropIndex, 0, draggedTab);

		onTabsReorder?.(newTabs);
		setDropIndex(null);
	};

	return (
		<div className="flex h-11 w-full items-center bg-muted/40 px-2">
			{left && (
				<div className="mr-1 flex shrink-0 items-center gap-1">{left}</div>
			)}
			<div
				ref={scrollRef}
				role="tablist"
				className="no-scrollbar relative flex h-full flex-1 items-end gap-0.5 overflow-x-auto pb-0"
				onDragOver={(e) => e.preventDefault()}
				onDrop={handleDrop}
			>
				{tabs.map((tab, index) => {
					const isActive = tab.relativePath === activePath;
					const showLeftIndicator =
						dropIndex === index &&
						draggedIndex !== index &&
						draggedIndex !== index - 1;
					const showRightIndicator =
						dropIndex === index + 1 &&
						draggedIndex !== index &&
						draggedIndex !== index + 1;

					return (
						<ContextMenu key={tab.relativePath}>
							<ContextMenuTrigger asChild>
								<div
									key={tab.relativePath}
									role="tab"
									aria-selected={isActive}
									tabIndex={0}
									draggable={true}
									onDragStart={(e) => handleDragStart(e, index)}
									onDragEnd={handleDragEnd}
									onDragOver={(e) => handleDragOver(e, index)}
									className={cn(
										"group relative flex h-9 min-w-36 max-w-52 items-center rounded-t-lg px-3 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
										isActive
											? "z-10 bg-background text-foreground shadow-[0_-1px_0_0_var(--border),1px_0_0_0_var(--border),-1px_0_0_0_var(--border)]"
											: "text-muted-foreground hover:bg-background/60 hover:text-foreground/80",
										draggedIndex === index && "opacity-50",
									)}
									onClick={() => onTabSelect(tab)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											onTabSelect(tab);
										}
									}}
								>
									{showLeftIndicator && (
										<div className="pointer-events-none absolute top-1 bottom-1 -left-[1.5px] z-50 w-0.5 rounded-full bg-primary" />
									)}
									{showRightIndicator && (
										<div className="pointer-events-none absolute top-1 -right-[1.5px] bottom-1 z-50 w-0.5 rounded-full bg-primary" />
									)}
									<div className="flex w-full items-center gap-2">
										<HugeiconsIcon
											icon={File01Icon}
											className={cn(
												"h-3.5 w-3.5 shrink-0 transition-colors",
												isActive
													? "text-foreground/70"
													: "text-muted-foreground/70",
											)}
										/>
										<span className="flex-1 truncate text-left font-medium text-[13px]">
											{tab.name}
										</span>
										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												onTabClose(tab.relativePath);
											}}
											className={cn(
												"-mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded transition-all",
												"hover:bg-foreground/10 active:bg-foreground/15",
												isActive
													? "opacity-60 hover:opacity-100"
													: "opacity-0 group-hover:opacity-60 group-hover:hover:opacity-100",
											)}
											title="Close Tab"
										>
											<HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
										</button>
									</div>
								</div>
							</ContextMenuTrigger>
							<ContextMenuContent>
								{onTabsCloseOther && (
									<ContextMenuItem
										onClick={() => onTabsCloseOther(tab.relativePath)}
									>
										<HugeiconsIcon
											icon={Cancel01Icon}
											className="mr-2 h-3.5 w-3.5"
										/>
										<span>Close Others</span>
									</ContextMenuItem>
								)}
								{onTabsCloseAll && tabs.length > 1 && (
									<ContextMenuItem
										onClick={() => onTabsCloseAll()}
										variant="destructive"
									>
										<span>Close All</span>
									</ContextMenuItem>
								)}
								{onTabsCloseToRight && index < tabs.length - 1 && (
									<ContextMenuItem
										onClick={() => onTabsCloseToRight(tab.relativePath)}
									>
										<span>Close Tabs to Right</span>
									</ContextMenuItem>
								)}
								<ContextMenuSeparator />
								{onCopyFilePath && (
									<ContextMenuItem
										onClick={() => onCopyFilePath(tab.relativePath)}
									>
										<HugeiconsIcon
											icon={Copy01Icon}
											className="mr-2 h-3.5 w-3.5"
										/>
										<span>Copy Path</span>
									</ContextMenuItem>
								)}
							</ContextMenuContent>
						</ContextMenu>
					);
				})}
			</div>
			{right && (
				<div className="ml-1 flex shrink-0 items-center gap-1">{right}</div>
			)}
		</div>
	);
}
