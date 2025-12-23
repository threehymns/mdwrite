import { Dialog } from "@base-ui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import * as React from "react";
import { cn } from "@/lib/utils";

interface CommandPaletteProps {
	isOpen: boolean;
	onClose: () => void;
	placeholder?: string;
	query: string;
	onQueryChange: (query: string) => void;
	icon?: any;
	children: React.ReactNode;
}

export function CommandPalette({
	isOpen,
	onClose,
	placeholder = "Search...",
	query,
	onQueryChange,
	icon: Icon,
	children,
}: CommandPaletteProps) {
	const inputRef = React.useRef<HTMLInputElement>(null);

	React.useEffect(() => {
		if (isOpen) {
			const timer = setTimeout(() => inputRef.current?.focus(), 50);
			return () => clearTimeout(timer);
		}
	}, [isOpen]);

	return (
		<Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<Dialog.Portal>
				<Dialog.Backdrop
					className={cn(
						"fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
						"data-[open]:fade-in-0 data-[closed]:fade-out-0 data-[closed]:animate-out data-[open]:animate-in",
					)}
				/>
				<Dialog.Popup
					className={cn(
						"-translate-x-1/2 fixed top-[20%] left-1/2 z-50 w-full max-w-xl overflow-hidden rounded-xl border bg-popover shadow-2xl",
						"data-[open]:fade-in-0 data-[closed]:fade-out-0 data-[open]:zoom-in-95 data-[closed]:zoom-out-95 data-[closed]:animate-out data-[open]:animate-in",
					)}
				>
					<div className="flex items-center border-b px-3">
						{Icon && (
							<HugeiconsIcon
								icon={Icon}
								className="mr-2 h-4 w-4 shrink-0 opacity-50"
							/>
						)}
						<input
							ref={inputRef}
							className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
							placeholder={placeholder}
							value={query}
							onChange={(e) => onQueryChange(e.target.value)}
						/>
					</div>
					<div className="max-h-[300px] overflow-y-auto p-2">{children}</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
