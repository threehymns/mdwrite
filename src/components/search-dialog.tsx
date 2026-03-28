import { File01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as React from "react";
import { type FileNode, searchFiles } from "@/lib/fs";
import { CommandPalette } from "./ui/command-palette";

interface SearchDialogProps {
	isOpen: boolean;
	onClose: () => void;
	rootHandle: FileSystemDirectoryHandle | null;
	onFileSelect: (file: FileNode) => void;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
	if (!query.trim()) {
		return <span>{text}</span>;
	}

	// Try to find the most relevant term to highlight
	const terms = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
	let highlight = "";
	for (const term of terms) {
		if (!term.includes(":") && !term.startsWith("-") && !term.startsWith("/")) {
			const cleaned = term.replace(/"/g, "");
			if (text.toLowerCase().includes(cleaned.toLowerCase())) {
				highlight = cleaned;
				break;
			}
		}
	}

	if (!highlight) {
		return <span>{text}</span>;
	}

	const parts = text.split(new RegExp(`(${highlight})`, "gi"));
	return (
		<span>
			{parts.map((part, i) =>
				part.toLowerCase() === highlight.toLowerCase() ? (
					<mark
						key={`highlight-${i}-${part}`}
						className="rounded-sm bg-primary/20 px-0.5 text-primary-foreground"
					>
						{part}
					</mark>
				) : (
					<span key={`text-${i}-${part}`}>{part}</span>
				),
			)}
		</span>
	);
}

export function SearchDialog({
	isOpen,
	onClose,
	rootHandle,
	onFileSelect,
}: SearchDialogProps) {
	const [query, setQuery] = React.useState("");
	const [results, setResults] = React.useState<
		{ node: FileNode; snippet: string }[]
	>([]);
	const [isSearching, setIsSearching] = React.useState(false);
	const searchRequestRef = React.useRef(0);

	React.useEffect(() => {
		if (!isOpen) {
			++searchRequestRef.current;
			setQuery("");
			setResults([]);
		}
	}, [isOpen]);

	React.useEffect(() => {
		const performSearch = async () => {
			if (!rootHandle || query.length < 2) {
				++searchRequestRef.current;
				setResults([]);
				setIsSearching(false);
				return;
			}

			const requestId = ++searchRequestRef.current;
			setIsSearching(true);
			try {
				const searchResults = await searchFiles(rootHandle, query);
				if (requestId === searchRequestRef.current) {
					setResults(searchResults);
				}
			} catch (error) {
				console.error("Search failed:", error);
			} finally {
				if (requestId === searchRequestRef.current) {
					setIsSearching(false);
				}
			}
		};

		const timer = setTimeout(performSearch, 300);
		return () => clearTimeout(timer);
	}, [query, rootHandle]);

	return (
		<CommandPalette
			isOpen={isOpen}
			onClose={onClose}
			query={query}
			onQueryChange={setQuery}
			placeholder="Search content..."
			icon={Search01Icon}
		>
			<div className="space-y-1">
				{isSearching ? (
					<div className="py-6 text-center text-muted-foreground text-sm">
						Searching...
					</div>
				) : results.length > 0 ? (
					results.map((result) => (
						<button
							key={`${result.node.relativePath}-${result.snippet}`}
							type="button"
							className="flex w-full flex-col items-start gap-1 rounded-md px-3 py-2 text-left hover:bg-secondary/50"
							onClick={() => {
								onFileSelect(result.node);
								onClose();
							}}
						>
							<div className="flex items-center gap-2 font-medium text-sm">
								<HugeiconsIcon icon={File01Icon} className="h-4 w-4" />
								<span>{result.node.name}</span>
								<span className="font-normal text-muted-foreground text-xs">
									{result.node.relativePath}
								</span>
							</div>
							<div className="line-clamp-2 text-muted-foreground text-xs">
								<HighlightedText text={result.snippet} query={query} />
							</div>
						</button>
					))
				) : query.length >= 2 ? (
					<div className="py-6 text-center text-muted-foreground text-sm">
						No results found for "{query}"
					</div>
				) : (
					<div className="py-6 text-center text-muted-foreground text-sm">
						Type at least 2 characters to search
					</div>
				)}
			</div>
		</CommandPalette>
	);
}
