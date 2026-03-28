import type { Editor, Range } from "@tiptap/core";
import type { SuggestionProps } from "@tiptap/suggestion";
import type React from "react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { cn } from "@/lib/utils";

export interface SuggestionItem {
	title: string;
	icon: React.ReactNode;
	badge?: string;
	shortcut?: string;
	category: string;
	command: ({ editor, range }: { editor: Editor; range: Range }) => void;
}

export interface SuggestionListProps extends SuggestionProps {
	items: SuggestionItem[];
}

export const SlashCommandList = forwardRef(
	(props: SuggestionListProps, ref) => {
		const [selectedIndex, setSelectedIndex] = useState(0);

		const selectItem = (index: number) => {
			const item = props.items[index];
			if (item) {
				props.command(item);
			}
		};

		// Reset selection when items change
		useEffect(() => {
			setSelectedIndex(0);
		}, []);

		useImperativeHandle(ref, () => ({
			onKeyDown: ({ event }: { event: KeyboardEvent }) => {
				if (event.key === "ArrowUp") {
					setSelectedIndex(
						(selectedIndex + props.items.length - 1) % props.items.length,
					);
					return true;
				}

				if (event.key === "ArrowDown") {
					setSelectedIndex((selectedIndex + 1) % props.items.length);
					return true;
				}

				if (event.key === "Enter") {
					selectItem(selectedIndex);
					return true;
				}

				return false;
			},
		}));

		return (
			<div className="z-50 flex w-72 flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
				<div className="scrollbar-thin max-w-[400px] overflow-hidden p-2">
					{props.items.length > 0 ? (
						props.items.map((item, index) => {
							const isFirstInCategory =
								index === 0 ||
								item.category !== props.items[index - 1].category;

							return (
								<div key={item.title}>
									{isFirstInCategory && (
										<div className="mt-2 mb-1 px-2 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
											{item.category}
										</div>
									)}
									<button
										type="button"
										className={cn(
											"flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
											index === selectedIndex
												? "bg-accent text-accent-foreground"
												: "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
										)}
										onClick={() => selectItem(index)}
										onMouseEnter={() => setSelectedIndex(index)}
									>
										<div className="flex items-center gap-3">
											<div className="flex h-5 w-5 items-center justify-center text-muted-foreground/50">
												{item.icon}
											</div>
											<div className="flex items-center gap-2">
												<span>{item.title}</span>
												{item.badge && (
													<span className="rounded bg-blue-500/20 px-1.5 py-0.5 font-medium text-[10px] text-blue-400">
														{item.badge}
													</span>
												)}
											</div>
										</div>
										{item.shortcut && (
											<span className="font-mono text-[10px] text-muted-foreground/30">
												{item.shortcut}
											</span>
										)}
									</button>
									{isFirstInCategory && item.category === "Suggested" && (
										<div className="my-2 h-px bg-border/50" />
									)}
								</div>
							);
						})
					) : (
						<div className="px-2 py-1.5 text-muted-foreground/30 text-xs">
							No results found
						</div>
					)}
				</div>
			</div>
		);
	},
);

SlashCommandList.displayName = "SlashCommandList";
