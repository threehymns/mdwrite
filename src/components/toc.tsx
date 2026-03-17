import * as React from "react";
import { cn } from "@/lib/utils";

import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface Heading {
	level: number;
	text: string;
	index: number;
}

interface TableOfContentsProps {
	headings: Heading[];
	onHeadingClick: (index: number) => void;
	activeHeadingIndex?: number;
}

export function TableOfContents({
	headings,
	onHeadingClick,
	activeHeadingIndex,
}: TableOfContentsProps) {
	const [isExpanded, setIsExpanded] = React.useState(false);

	if (headings.length === 0) return null;

	return (
		<aside
			aria-label="Table of Contents"
			className={cn(
				"fixed top-24 right-4 z-50 flex flex-col items-end transition-all duration-300 ease-in-out",
				isExpanded ? "w-64" : "w-12",
			)}
			onMouseEnter={() => setIsExpanded(true)}
			onMouseLeave={() => setIsExpanded(false)}
		>
			<div
				className={cn(
					"flex flex-col rounded-xl bg-background/80 p-2 shadow-lg backdrop-blur-sm transition-all duration-300",
					isExpanded
						? "w-full border opacity-100"
						: "w-8 items-end border-transparent opacity-40 hover:opacity-100",
				)}
			>
				{headings.map((heading) => {
					const isActive = activeHeadingIndex === heading.index;

					return (
						<ContextMenu key={`${heading.index}-${heading.text}`}>
							<ContextMenuTrigger asChild>
								<button
									type="button"
									onClick={() => onHeadingClick(heading.index)}
									className={cn(
										"group relative flex w-full items-center rounded-md transition-all",
										isExpanded
											? "px-2 py-1 hover:bg-secondary"
											: "h-0.5 justify-end px-0 py-1",
									)}
								>
									{isExpanded ? (
										<div className="flex w-full items-center gap-2 overflow-hidden">
											<span className="text-[10px] text-muted-foreground/40">
												{"#".repeat(heading.level)}
											</span>
											<span
												className={cn(
													"truncate text-left text-xs transition-colors",
													isActive
														? "font-medium text-primary"
														: "text-muted-foreground group-hover:text-foreground",
												)}
												style={{ marginLeft: `${(heading.level - 1) * 8}px` }}
											>
												{heading.text}
											</span>
										</div>
									) : (
										<div
											className={cn(
												"h-0.5 max-w-8 rounded-full bg-muted-foreground/30 transition-all group-hover:bg-foreground",
												isActive && "w-5 bg-primary",
												!isActive &&
													(heading.level === 1
														? "w-4"
														: heading.level === 2
															? "w-3"
															: "w-2"),
											)}
										/>
									)}
								</button>
							</ContextMenuTrigger>
							<ContextMenuContent>
								<ContextMenuItem
									onClick={() => onHeadingClick(heading.index)}
								>
									<span>Go to heading</span>
								</ContextMenuItem>
								<ContextMenuItem
									onClick={() => {
										navigator.clipboard.writeText(heading.text);
									}}
								>
									<span>Copy heading text</span>
								</ContextMenuItem>
								<ContextMenuItem
									onClick={() => {
										const markdown = "#".repeat(heading.level) + " ";
										navigator.clipboard.writeText(markdown + heading.text);
									}}
								>
									<span>Copy as markdown</span>
								</ContextMenuItem>
							</ContextMenuContent>
						</ContextMenu>
					);
				})}
			</div>
		</aside>
	);
}
