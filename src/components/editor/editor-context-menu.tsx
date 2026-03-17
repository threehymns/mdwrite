import {
	ArrowRight01Icon,
	CodeIcon,
	Copy01Icon,
	Delete01Icon,
	Edit01Icon,
	ExternalLink,
	FilePasteIcon,
	HeadingIcon,
	Link01Icon,
	ParagraphIcon,
	QuotesIcon,
	Scissor01Icon,
	TextAlignLeftIcon,
	TextBoldIcon,
	TextItalicIcon,
	TextStrikethroughIcon,
	TextUnderlineIcon,
	CheckListIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as React from "react";

import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";

export interface EditorContextMenuState {
	isOpen: boolean;
	x: number;
	y: number;
	type: "editor" | "link" | "image";
	linkUrl?: string;
	imageSrc?: string;
}

interface EditorContextMenuProps {
	children: React.ReactNode;
	onBold?: () => void;
	onItalic?: () => void;
	onUnderline?: () => void;
	onStrike?: () => void;
	onCode?: () => void;
	onHeading?: (level: 1 | 2 | 3 | 4 | 5 | 6) => void;
	onBulletList?: () => void;
	onOrderedList?: () => void;
	onTaskList?: () => void;
	onBlockquote?: () => void;
	onCodeBlock?: () => void;
	onParagraph?: () => void;
	onLinkOpen?: (url: string) => void;
	onLinkCopy?: (url: string) => void;
	onLinkEdit?: (url: string) => void;
	onImageCopy?: (src: string) => void;
	onImageSaveAs?: (src: string) => void;
	onImageDelete?: () => void;
	menuState: EditorContextMenuState;
}

export function EditorContextMenu({
	children,
	onBold,
	onItalic,
	onUnderline,
	onStrike,
	onCode,
	onHeading,
	onBulletList,
	onOrderedList,
	onTaskList,
	onBlockquote,
	onCodeBlock,
	onParagraph,
	onLinkOpen,
	onLinkCopy,
	onLinkEdit,
	onImageCopy,
	onImageSaveAs,
	onImageDelete,
	menuState,
}: EditorContextMenuProps) {
	const handleCopy = React.useCallback(() => {
		document.execCommand("copy");
	}, []);

	const handleCut = React.useCallback(() => {
		document.execCommand("cut");
	}, []);

	const handlePaste = React.useCallback(() => {
		navigator.clipboard.readText();
	}, []);

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<div className="flex-1 overflow-hidden">{children}</div>
			</ContextMenuTrigger>
			<ContextMenuContent>
				{menuState.type === "link" && menuState.linkUrl && (
					<>
						<ContextMenuLabel>Link</ContextMenuLabel>
						<ContextMenuItem
							onClick={() => onLinkOpen?.(menuState.linkUrl!)}
						>
							<HugeiconsIcon
								icon={ExternalLink}
								className="mr-2 h-3.5 w-3.5"
							/>
							<span>Open Link</span>
						</ContextMenuItem>
						<ContextMenuItem
							onClick={() => onLinkCopy?.(menuState.linkUrl!)}
						>
							<HugeiconsIcon
								icon={Copy01Icon}
								className="mr-2 h-3.5 w-3.5"
							/>
							<span>Copy Link</span>
						</ContextMenuItem>
						<ContextMenuItem
							onClick={() => onLinkEdit?.(menuState.linkUrl!)}
						>
							<HugeiconsIcon
								icon={Edit01Icon}
								className="mr-2 h-3.5 w-3.5"
							/>
							<span>Edit Link</span>
						</ContextMenuItem>
						<ContextMenuSeparator />
					</>
				)}
				{menuState.type === "image" && menuState.imageSrc && (
					<>
						<ContextMenuLabel>Image</ContextMenuLabel>
						<ContextMenuItem
							onClick={() => onImageCopy?.(menuState.imageSrc!)}
						>
							<HugeiconsIcon
								icon={Copy01Icon}
								className="mr-2 h-3.5 w-3.5"
							/>
							<span>Copy Image</span>
						</ContextMenuItem>
						<ContextMenuItem
							onClick={() => onImageSaveAs?.(menuState.imageSrc!)}
						>
							<HugeiconsIcon
								icon={ArrowRight01Icon}
								className="mr-2 h-3.5 w-3.5"
							/>
							<span>Save Image As...</span>
						</ContextMenuItem>
						<ContextMenuSeparator />
						<ContextMenuItem
							variant="destructive"
							onClick={onImageDelete}
						>
							<HugeiconsIcon
								icon={Delete01Icon}
								className="mr-2 h-3.5 w-3.5"
							/>
							<span>Delete Image</span>
						</ContextMenuItem>
						<ContextMenuSeparator />
					</>
				)}
				{menuState.type === "editor" && (
					<>
						<ContextMenuItem onClick={handleCopy}>
							<HugeiconsIcon
								icon={Copy01Icon}
								className="mr-2 h-3.5 w-3.5"
							/>
							<span>Copy</span>
							<ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
						</ContextMenuItem>
						<ContextMenuItem onClick={handleCut}>
							<HugeiconsIcon
								icon={Scissor01Icon}
								className="mr-2 h-3.5 w-3.5"
							/>
							<span>Cut</span>
							<ContextMenuShortcut>Ctrl+X</ContextMenuShortcut>
						</ContextMenuItem>
						<ContextMenuItem onClick={handlePaste}>
							<HugeiconsIcon
								icon={FilePasteIcon}
								className="mr-2 h-3.5 w-3.5"
							/>
							<span>Paste</span>
							<ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
						</ContextMenuItem>
						<ContextMenuSeparator />
						<ContextMenuGroup>
							<ContextMenuSub>
								<ContextMenuSubTrigger inset>
									<HugeiconsIcon
										icon={HeadingIcon}
										className="mr-2 h-3.5 w-3.5"
									/>
									<span>Heading</span>
								</ContextMenuSubTrigger>
								<ContextMenuSubContent>
									<ContextMenuItem onClick={() => onHeading?.(1)}>
										<span>Heading 1</span>
									</ContextMenuItem>
									<ContextMenuItem onClick={() => onHeading?.(2)}>
										<span>Heading 2</span>
									</ContextMenuItem>
									<ContextMenuItem onClick={() => onHeading?.(3)}>
										<span>Heading 3</span>
									</ContextMenuItem>
									<ContextMenuItem onClick={() => onHeading?.(4)}>
										<span>Heading 4</span>
									</ContextMenuItem>
									<ContextMenuItem onClick={() => onHeading?.(5)}>
										<span>Heading 5</span>
									</ContextMenuItem>
									<ContextMenuItem onClick={() => onHeading?.(6)}>
										<span>Heading 6</span>
									</ContextMenuItem>
								</ContextMenuSubContent>
							</ContextMenuSub>
						</ContextMenuGroup>
						<ContextMenuSeparator />
						<ContextMenuItem onClick={onBold}>
							<HugeiconsIcon icon={TextBoldIcon} className="mr-2 h-3.5 w-3.5" />
							<span>Bold</span>
							<ContextMenuShortcut>Ctrl+B</ContextMenuShortcut>
						</ContextMenuItem>
						<ContextMenuItem onClick={onItalic}>
							<HugeiconsIcon
								icon={TextItalicIcon}
								className="mr-2 h-3.5 w-3.5"
							/>
							<span>Italic</span>
							<ContextMenuShortcut>Ctrl+I</ContextMenuShortcut>
						</ContextMenuItem>
						<ContextMenuItem onClick={onUnderline}>
							<HugeiconsIcon
								icon={TextUnderlineIcon}
								className="mr-2 h-3.5 w-3.5"
							/>
							<span>Underline</span>
							<ContextMenuShortcut>Ctrl+U</ContextMenuShortcut>
						</ContextMenuItem>
						<ContextMenuItem onClick={onStrike}>
							<HugeiconsIcon
								icon={TextStrikethroughIcon}
								className="mr-2 h-3.5 w-3.5"
							/>
							<span>Strikethrough</span>
						</ContextMenuItem>
						<ContextMenuItem onClick={onCode}>
							<HugeiconsIcon icon={CodeIcon} className="mr-2 h-3.5 w-3.5" />
							<span>Inline Code</span>
							<ContextMenuShortcut>Ctrl+E</ContextMenuShortcut>
						</ContextMenuItem>
						<ContextMenuSeparator />
						<ContextMenuItem onClick={onParagraph}>
							<HugeiconsIcon
								icon={TextAlignLeftIcon}
								className="mr-2 h-3.5 w-3.5"
							/>
							<span>Paragraph</span>
						</ContextMenuItem>
						<ContextMenuGroup>
							<ContextMenuSub>
								<ContextMenuSubTrigger inset>
									<HugeiconsIcon
										icon={CheckListIcon}
										className="mr-2 h-3.5 w-3.5"
									/>
									<span>List</span>
								</ContextMenuSubTrigger>
								<ContextMenuSubContent>
									<ContextMenuItem onClick={onBulletList}>
										<span>Bullet List</span>
									</ContextMenuItem>
									<ContextMenuItem onClick={onOrderedList}>
										<span>Numbered List</span>
									</ContextMenuItem>
									<ContextMenuItem onClick={onTaskList}>
										<span>Task List</span>
									</ContextMenuItem>
								</ContextMenuSubContent>
							</ContextMenuSub>
						</ContextMenuGroup>
						<ContextMenuSeparator />
						<ContextMenuItem onClick={onBlockquote}>
							<HugeiconsIcon icon={QuotesIcon} className="mr-2 h-3.5 w-3.5" />
							<span>Blockquote</span>
						</ContextMenuItem>
						<ContextMenuItem onClick={onCodeBlock}>
							<HugeiconsIcon icon={CodeIcon} className="mr-2 h-3.5 w-3.5" />
							<span>Code Block</span>
						</ContextMenuItem>
					</>
				)}
			</ContextMenuContent>
		</ContextMenu>
	);
}
