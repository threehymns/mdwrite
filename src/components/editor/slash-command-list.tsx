import type { Editor, Range } from "@tiptap/core";
import type React from "react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { cn } from "@/lib/utils";

export interface SuggestionItem {
	title: string;
	description: string;
	icon: React.ReactNode;
	command: ({ editor, range }: { editor: Editor; range: Range }) => void;
}

export interface SuggestionListProps {
	items: SuggestionItem[];
	command: (item: SuggestionItem) => void;
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
			<div className="scrollbar-thin z-50 h-auto max-h-[330px] w-72 overflow-y-auto rounded-lg border border-border bg-background p-1 shadow-md">
				{props.items.length > 0 ? (
					props.items.map((item, index) => (
						<button
							key={item.title}
							type="button"
							className={cn(
								"flex w-full items-center space-x-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
								index === selectedIndex
									? "bg-accent text-accent-foreground"
									: "hover:bg-muted",
							)}
							onClick={() => selectItem(index)}
						>
							<div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background">
								{item.icon}
							</div>
							<div>
								<p className="font-medium">{item.title}</p>
								<p className="text-muted-foreground text-xs">
									{item.description}
								</p>
							</div>
						</button>
					))
				) : (
					<div className="px-2 py-1.5 text-muted-foreground text-sm">
						No results found
					</div>
				)}
			</div>
		);
	},
);

SlashCommandList.displayName = "SlashCommandList";
