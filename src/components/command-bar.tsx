import { ZapIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as React from "react";
import type { Action } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./ui/command-palette";

interface CommandBarProps {
	isOpen: boolean;
	onClose: () => void;
	actions: Action[];
}

export function CommandBar({ isOpen, onClose, actions }: CommandBarProps) {
	const [query, setQuery] = React.useState("");

	const filteredActions = React.useMemo(() => {
		if (!query) return actions;
		const lowerQuery = query.toLowerCase();
		return actions.filter(
			(action) =>
				action.title.toLowerCase().includes(lowerQuery) ||
				action.description?.toLowerCase().includes(lowerQuery),
		);
	}, [actions, query]);

	React.useEffect(() => {
		if (!isOpen) {
			setQuery("");
		}
	}, [isOpen]);

	return (
		<CommandPalette
			isOpen={isOpen}
			onClose={onClose}
			query={query}
			onQueryChange={setQuery}
			placeholder="Type a command or search..."
			icon={ZapIcon}
		>
			<div className="space-y-1">
				{filteredActions.length > 0 ? (
					filteredActions.map((action) => (
						<button
							key={action.id}
							type="button"
							className={cn(
								"flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-secondary/50",
							)}
							onClick={() => {
								action.perform();
								onClose();
							}}
						>
							{action.icon && (
								<HugeiconsIcon
									icon={action.icon as any}
									className="h-4 w-4 shrink-0 opacity-70"
								/>
							)}
							<div className="flex flex-1 flex-col">
								<span className="font-medium text-sm">{action.title}</span>
								{action.description && (
									<span className="text-muted-foreground text-xs">
										{action.description}
									</span>
								)}
							</div>
							{action.shortcut && (
								<div className="flex items-center gap-0.5">
									{action.shortcut.map((key) => (
										<kbd
											key={key}
											className="rounded border bg-muted px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground uppercase"
										>
											{key}
										</kbd>
									))}
								</div>
							)}
						</button>
					))
				) : (
					<div className="py-6 text-center text-muted-foreground text-sm">
						No commands found for "{query}"
					</div>
				)}
			</div>
		</CommandPalette>
	);
}
