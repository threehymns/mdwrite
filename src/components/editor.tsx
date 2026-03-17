import {
	Extension,
	InputRule,
	type Editor as TiptapEditor,
} from "@tiptap/core";
import CharacterCount from "@tiptap/extension-character-count";
import Link, { isAllowedUri } from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import * as React from "react";
import { Markdown } from "tiptap-markdown";
import {
	parseInternalLinkHref,
	serializeInternalLinkMarkdown,
} from "@/lib/internal-links";
import { CodeBlockCodeMirror } from "./editor/extensions/code-block-codemirror";
import { ImageWithResolver } from "./editor/extensions/image-with-resolver";
import { InternalLinkMarkdown } from "./editor/extensions/internal-link-markdown";
import { SlashCommand, suggestion } from "./editor/extensions/slash-command";
import {
	EditorContextMenu,
	type EditorContextMenuState,
} from "./editor/editor-context-menu";

const TaskListInputRule = Extension.create({
	name: "taskListInputRule",
	addInputRules() {
		return [
			// Handle the case where we type "- [ ] " or "- [x] " on a new line
			new InputRule({
				find: /^\s*([-+*])\s+\[( |x)\]\s$/,
				handler: ({ range, match, chain }: any) => {
					const start = range.from;
					const end = range.to;
					const isChecked = match[2] === "x";

					if (match[0]) {
						chain()
							.deleteRange({ from: start, to: end })
							.toggleTaskList()
							.updateAttributes("taskItem", { checked: isChecked })
							.run();
					}
				},
			}),
			// Handle the case where we're already in a bullet list and type "[ ] " or "[x] "
			new InputRule({
				find: /^\[( |x)\]\s$/,
				handler: ({ range, match, chain }: any) => {
					const start = range.from;
					const end = range.to;
					const isChecked = match[1] === "x";

					chain()
						.deleteRange({ from: start, to: end })
						.toggleTaskList()
						.updateAttributes("taskItem", { checked: isChecked })
						.run();
				},
			}),
		];
	},
});

const MARKDOWN_SYNC_DELAY_MS = 120;

interface EditorProps {
	content: string;
	onChange: (content: string) => void;
	onImageUpload?: (file: File) => Promise<string | null>;
	resolveImagePath?: (path: string) => Promise<string | null>;
	active?: boolean;
	onFrontmatterTrigger?: () => void;
	onInternalLinkClick?: (target: string) => void;
	onContextMenuStateChange?: (state: EditorContextMenuState) => void;
}

export interface EditorHandle {
	scrollToHeading: (text: string, level: number) => void;
}

type EditorComponentProps = EditorProps & {
	editorRef?: React.RefObject<EditorHandle | null>;
};

function areEditorPropsEqual(
	prev: EditorComponentProps,
	next: EditorComponentProps,
) {
	if (prev.active || next.active) {
		return (
			prev.active === next.active &&
			prev.content === next.content &&
			prev.onChange === next.onChange &&
			prev.onImageUpload === next.onImageUpload &&
			prev.resolveImagePath === next.resolveImagePath &&
			prev.editorRef === next.editorRef &&
			prev.onInternalLinkClick === next.onInternalLinkClick
		);
	}

	return (
		prev.active === next.active &&
		prev.onChange === next.onChange &&
		prev.onImageUpload === next.onImageUpload &&
		prev.resolveImagePath === next.resolveImagePath &&
		prev.editorRef === next.editorRef &&
		prev.onInternalLinkClick === next.onInternalLinkClick
	);
}

function EditorComponent({
	content,
	onChange,
	onImageUpload,
	resolveImagePath,
	editorRef,
	active,
	onFrontmatterTrigger,
	onInternalLinkClick,
	onContextMenuStateChange,
}: EditorComponentProps) {
	const lastContentRef = React.useRef(content);
	const onChangeRef = React.useRef(onChange);
	const activeRef = React.useRef(active);
	const onFrontmatterTriggerRef = React.useRef(onFrontmatterTrigger);
	const markdownSyncTimeoutRef = React.useRef<number | null>(null);
	const pendingMarkdownEditorRef = React.useRef<TiptapEditor | null>(null);
	const [contextMenuState, setContextMenuState] =
		React.useState<EditorContextMenuState>({
			isOpen: false,
			x: 0,
			y: 0,
			type: "editor",
		});

	React.useEffect(() => {
		onFrontmatterTriggerRef.current = onFrontmatterTrigger;
	}, [onFrontmatterTrigger]);

	const flushPendingMarkdown = React.useCallback(() => {
		const pendingEditor = pendingMarkdownEditorRef.current;
		if (!pendingEditor) return;
		// @ts-expect-error - markdown is added by the extension
		const markdown = pendingEditor.storage.markdown.getMarkdown() as string;
		const normalized = serializeInternalLinkMarkdown(markdown);
		if (normalized === lastContentRef.current) return;
		lastContentRef.current = normalized;
		onChangeRef.current(normalized);
	}, []);

	const scheduleMarkdownSync = React.useCallback(
		(editor: TiptapEditor) => {
			pendingMarkdownEditorRef.current = editor;
			if (markdownSyncTimeoutRef.current !== null) {
				window.clearTimeout(markdownSyncTimeoutRef.current);
			}
			markdownSyncTimeoutRef.current = window.setTimeout(() => {
				markdownSyncTimeoutRef.current = null;
				flushPendingMarkdown();
			}, MARKDOWN_SYNC_DELAY_MS);
		},
		[flushPendingMarkdown],
	);

	const flushMarkdownSyncNow = React.useCallback(() => {
		if (markdownSyncTimeoutRef.current !== null) {
			window.clearTimeout(markdownSyncTimeoutRef.current);
			markdownSyncTimeoutRef.current = null;
		}
		flushPendingMarkdown();
	}, [flushPendingMarkdown]);

	React.useEffect(() => {
		onChangeRef.current = onChange;
		activeRef.current = active;
	}, [onChange, active]);

	React.useEffect(() => {
		return () => {
			if (markdownSyncTimeoutRef.current !== null) {
				window.clearTimeout(markdownSyncTimeoutRef.current);
				markdownSyncTimeoutRef.current = null;
			}
			flushPendingMarkdown();
		};
	}, [flushPendingMarkdown]);

	// State to force re-render on selection change
	const [, setSelectionKey] = React.useState(0);

	const editor = useEditor({
		extensions: [
			TaskList,
			TaskItem.configure({
				nested: true,
			}),
			StarterKit.configure({
				codeBlock: false,
				link: false,
			}),
			Underline,
			Link.configure({
				openOnClick: false,
				protocols: ["internal-link", "internal-link-embed"],
				isAllowedUri: (url, ctx) => {
					const trimmed = url?.trim() ?? "";
					// Allow our internal protocols
					if (
						trimmed.startsWith("internal-link:") ||
						trimmed.startsWith("internal-link-embed:")
					) {
						return true;
					}
					// Block dangerous protocols
					if (/^(javascript|vbscript|data):/i.test(trimmed)) {
						return false;
					}
					// Use default validation for everything else
					return !!isAllowedUri(url, ctx.protocols);
				},
			}),
			InternalLinkMarkdown,
			CodeBlockCodeMirror,
			ImageWithResolver.configure({
				allowBase64: true,
				resolveImagePath,
			}),
			Placeholder.configure({
				placeholder: "Start writing...",
			}),
			CharacterCount,
			SlashCommand.configure({
				suggestion,
				onImageUpload,
			}),
			TaskListInputRule,
			Markdown,
		],
		content,
		onUpdate: ({ editor, transaction }) => {
			if (!activeRef.current) return;
			if (!transaction.docChanged) return;

			// Check for --- at the beginning (could be hr node from markdown extension)
			const firstNode = editor.state.doc.firstChild;
			const text = editor.getText();
			const firstLine = text.split("\n")[0];

			if (
				(firstLine.trim() === "---" ||
					firstNode?.type.name === "horizontalRule") &&
				onFrontmatterTriggerRef.current
			) {
				// Replace the first ---/hr with empty content
				const tr = editor.state.tr;
				tr.delete(0, editor.state.doc.content.size);
				editor.view.dispatch(tr);
				onFrontmatterTriggerRef.current();
			}

			scheduleMarkdownSync(editor);
		},
		onBlur: () => {
			flushMarkdownSyncNow();
		},
		onSelectionUpdate: () => {
			// Force re-render when selection changes to update word count display
			setSelectionKey((k) => k + 1);
		},
		editorProps: {
			attributes: {
				class:
					"prose !prose-shadcn prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none p-8 dark:prose-invert",
				style: "font-size: var(--editor-font-size, 16px)",
			},
			handleClickOn(_view, _pos, _node, _nodePos, _event, direct) {
				if (!direct) return false;
				const event = _event as MouseEvent;
				const target = event.target as HTMLElement;
				const anchor = target.closest("a");
				if (anchor) {
					const href = anchor.getAttribute("href");
					if (href) {
						const parsed = parseInternalLinkHref(href);
						if (parsed) {
							event.preventDefault();
							onInternalLinkClick?.(parsed.target);
							return true;
						}
					}
				}
				return false;
			},
			handleDrop(view, event, _slice, moved) {
				if (moved || !event.dataTransfer) return false;

				const { files } = event.dataTransfer;
				if (files && files.length > 0) {
					const file = files[0];
					if (file.type.startsWith("image/")) {
						onImageUpload?.(file).then((path) => {
							if (path) {
								const { schema } = view.state;
								const node = schema.nodes.image.create({ src: path });
								const transaction = view.state.tr.replaceSelectionWith(node);
								view.dispatch(transaction);
							}
						});
						return true;
					}
				}

				const url = event.dataTransfer.getData("text/uri-list");
				if (url) {
					const isImage =
						/\.(jpg|jpeg|png|gif|webp|svg|avif)($|\?)/i.test(url) ||
						url.startsWith("data:image/");
					if (isImage) {
						const { schema } = view.state;
						const node = schema.nodes.image.create({ src: url });
						const transaction = view.state.tr.replaceSelectionWith(node);
						view.dispatch(transaction);
						return true;
					}
				}

				const html = event.dataTransfer.getData("text/html");
				if (html) {
					const parser = new DOMParser();
					const doc = parser.parseFromString(html, "text/html");
					const img = doc.querySelector("img");
					if (img?.src) {
						const { schema } = view.state;
						const node = schema.nodes.image.create({ src: img.src });
						const transaction = view.state.tr.replaceSelectionWith(node);
						view.dispatch(transaction);
						return true;
					}
				}

				return false;
			},
			handlePaste(view, event) {
				const { clipboardData } = event;
				if (!clipboardData) return false;

				const { files } = clipboardData;
				if (files && files.length > 0) {
					const file = files[0];
					if (file.type.startsWith("image/")) {
						onImageUpload?.(file).then((path) => {
							if (path) {
								const { schema } = view.state;
								const node = schema.nodes.image.create({ src: path });
								const transaction = view.state.tr.replaceSelectionWith(node);
								view.dispatch(transaction);
							}
						});
						return true;
					}
				}

				const text = clipboardData.getData("text/plain");
				if (
					text &&
					/^https?:\/\/.*\.(jpg|jpeg|png|gif|webp|svg|avif)($|\?)/i.test(text)
				) {
					const { schema } = view.state;
					const node = schema.nodes.image.create({ src: text });
					const transaction = view.state.tr.replaceSelectionWith(node);
					view.dispatch(transaction);
					return true;
				}

				return false;
			},
			handleContextMenu(_view, event) {
				const domEvent = event as unknown as MouseEvent;
				const target = domEvent.target as HTMLElement;

				// Check if clicking on a link
				const anchor = target.closest("a");
				if (anchor) {
					const href = anchor.getAttribute("href");
					if (href) {
						const state: EditorContextMenuState = {
							isOpen: true,
							x: domEvent.clientX,
							y: domEvent.clientY,
							type: "link",
							linkUrl: href,
						};
						setContextMenuState(state);
						onContextMenuStateChange?.(state);
						return;
					}
				}

				// Check if clicking on an image
				const image = target.closest("img");
				if (image) {
					const src = image.getAttribute("src");
					if (src) {
						const state: EditorContextMenuState = {
							isOpen: true,
							x: domEvent.clientX,
							y: domEvent.clientY,
							type: "image",
							imageSrc: src,
						};
						setContextMenuState(state);
						onContextMenuStateChange?.(state);
						return;
					}
				}

				// Default to editor context menu
				const state: EditorContextMenuState = {
					isOpen: true,
					x: domEvent.clientX,
					y: domEvent.clientY,
					type: "editor",
				};
				setContextMenuState(state);
				onContextMenuStateChange?.(state);
			},
		},
	});

	React.useImperativeHandle(editorRef, () => ({
		scrollToHeading: (text: string, level: number) => {
			if (!editor) return;
			let foundPos = -1;
			editor.state.doc.descendants((node, pos) => {
				if (
					node.type.name === "heading" &&
					node.attrs.level === level &&
					node.textContent === text
				) {
					foundPos = pos;
					return false;
				}
			});

			if (foundPos !== -1) {
				editor.commands.focus(foundPos);
				const dom = editor.view.nodeDOM(foundPos) as HTMLElement;
				if (dom) {
					dom.scrollIntoView({ behavior: "smooth", block: "start" });
				}
			}
		},
	}));

	React.useEffect(() => {
		if (active && editor && content !== lastContentRef.current) {
			const { from, to } = editor.state.selection;
			editor.commands.setContent(content, { emitUpdate: false });
			const docSize = editor.state.doc.content.size;
			editor.commands.setTextSelection({
				from: Math.min(from, docSize),
				to: Math.min(to, docSize),
			});
			lastContentRef.current = content;
		}
	}, [content, editor, active]);

	// Calculate word count for a given text
	const countWords = (text: string) => {
		const trimmed = text.trim();
		return trimmed ? trimmed.split(/\s+/).length : 0;
	};

	// Get selection info for display
	const selection = editor?.state.selection;
	const hasSelection = selection && selection.from !== selection.to;
	const selectedText = hasSelection
		? editor?.state.doc.textBetween(selection.from, selection.to, " ") || ""
		: "";
	const selectedWordCount = hasSelection ? countWords(selectedText) : 0;
	const selectedCharCount = hasSelection ? selectedText.length : 0;

	// Context menu formatting handlers
	const handleBold = React.useCallback(() => {
		editor?.chain().focus().toggleBold().run();
	}, [editor]);

	const handleItalic = React.useCallback(() => {
		editor?.chain().focus().toggleItalic().run();
	}, [editor]);

	const handleUnderline = React.useCallback(() => {
		editor?.chain().focus().toggleUnderline().run();
	}, [editor]);

	const handleStrike = React.useCallback(() => {
		editor?.chain().focus().toggleStrike().run();
	}, [editor]);

	const handleCode = React.useCallback(() => {
		editor?.chain().focus().toggleCode().run();
	}, [editor]);

	const handleHeading = React.useCallback(
		(level: 1 | 2 | 3 | 4 | 5 | 6) => {
			editor?.chain().focus().toggleHeading({ level }).run();
		},
		[editor],
	);

	const handleBulletList = React.useCallback(() => {
		editor?.chain().focus().toggleBulletList().run();
	}, [editor]);

	const handleOrderedList = React.useCallback(() => {
		editor?.chain().focus().toggleOrderedList().run();
	}, [editor]);

	const handleTaskList = React.useCallback(() => {
		editor?.chain().focus().toggleTaskList().run();
	}, [editor]);

	const handleBlockquote = React.useCallback(() => {
		editor?.chain().focus().toggleBlockquote().run();
	}, [editor]);

	const handleCodeBlock = React.useCallback(() => {
		editor?.chain().focus().toggleCodeBlock().run();
	}, [editor]);

	const handleParagraph = React.useCallback(() => {
		editor?.chain().focus().setParagraph().run();
	}, [editor]);

	const handleLinkOpen = React.useCallback(
		(url: string) => {
			// Check if it's an internal link
			const parsed = parseInternalLinkHref(url);
			if (parsed) {
				onInternalLinkClick?.(parsed.target);
			} else {
				window.open(url, "_blank");
			}
		},
		[onInternalLinkClick],
	);

	const handleLinkCopy = React.useCallback((url: string) => {
		navigator.clipboard.writeText(url);
	}, []);

	const handleLinkEdit = React.useCallback(
		(url: string) => {
			editor?.chain().focus().setLink({ href: url }).run();
		},
		[editor],
	);

	const handleImageCopy = React.useCallback((src: string) => {
		// Try to copy the image as a blob
		fetch(src)
			.then((res) => res.blob())
			.then((blob) => {
				try {
					navigator.clipboard.write([
						new ClipboardItem({ [blob.type]: blob }),
					]);
				} catch {
					// Fallback to copying the URL
					navigator.clipboard.writeText(src);
				}
			})
			.catch(() => {
				// Fallback to copying the URL
				navigator.clipboard.writeText(src);
			});
	}, []);

	const handleImageSaveAs = React.useCallback(async (src: string) => {
		try {
			const response = await fetch(src);
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = "image";
			link.click();
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error("Failed to save image:", err);
		}
	}, []);

	const handleImageDelete = React.useCallback(() => {
		editor?.chain().focus().deleteSelection().run();
	}, [editor]);

	return (
		<div className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">
			<EditorContextMenu
				menuState={contextMenuState}
				onBold={handleBold}
				onItalic={handleItalic}
				onUnderline={handleUnderline}
				onStrike={handleStrike}
				onCode={handleCode}
				onHeading={handleHeading}
				onBulletList={handleBulletList}
				onOrderedList={handleOrderedList}
				onTaskList={handleTaskList}
				onBlockquote={handleBlockquote}
				onCodeBlock={handleCodeBlock}
				onParagraph={handleParagraph}
				onLinkOpen={handleLinkOpen}
				onLinkCopy={handleLinkCopy}
				onLinkEdit={handleLinkEdit}
				onImageCopy={handleImageCopy}
				onImageSaveAs={handleImageSaveAs}
				onImageDelete={handleImageDelete}
			>
				<div className="flex-1 overflow-auto">
					<EditorContent editor={editor} />
				</div>
			</EditorContextMenu>
			<div className="flex h-8 shrink-0 items-center justify-between border-t bg-secondary/10 px-4 text-muted-foreground text-xs">
				<div className="flex gap-4">
					<span>
						{hasSelection
							? `${selectedWordCount} selected`
							: `${editor?.storage.characterCount.words()} words`}
					</span>
					<span>
						{hasSelection
							? `${selectedCharCount} selected`
							: `${editor?.storage.characterCount.characters()} characters`}
					</span>
				</div>
				<div>Markdown</div>
			</div>
		</div>
	);
}

export const Editor = React.memo(EditorComponent, areEditorPropsEqual);
Editor.displayName = "Editor";
