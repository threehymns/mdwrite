import { Extension, InputRule } from "@tiptap/core";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import * as React from "react";
import { Markdown } from "tiptap-markdown";
import { CodeBlockCodeMirror } from "./editor/extensions/code-block-codemirror";
import { ImageWithResolver } from "./editor/extensions/image-with-resolver";
import { SlashCommand, suggestion } from "./editor/extensions/slash-command";

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

interface EditorProps {
	content: string;
	onChange: (content: string) => void;
	onImageUpload?: (file: File) => Promise<string | null>;
	resolveImagePath?: (path: string) => Promise<string | null>;
	active?: boolean;
}

export interface EditorHandle {
	scrollToHeading: (text: string, level: number) => void;
}

export function Editor({
	content,
	onChange,
	onImageUpload,
	resolveImagePath,
	editorRef,
	active,
}: EditorProps & { editorRef?: React.RefObject<EditorHandle | null> }) {
	const lastContentRef = React.useRef(content);
	const onChangeRef = React.useRef(onChange);
	const activeRef = React.useRef(active);

	React.useEffect(() => {
		onChangeRef.current = onChange;
		activeRef.current = active;
	}, [onChange, active]);

	const editor = useEditor({
		extensions: [
			TaskList,
			TaskItem.configure({
				nested: true,
			}),
			StarterKit.configure({
				codeBlock: false,
			}),
			CodeBlockCodeMirror,
			ImageWithResolver.configure({
				allowBase64: true,
				resolveImagePath,
			}),
			Markdown,
			Placeholder.configure({
				placeholder: "Start writing...",
			}),
			CharacterCount,
			SlashCommand.configure({
				suggestion,
				onImageUpload,
			}),
			TaskListInputRule,
		],
		content,
		onUpdate: ({ editor }) => {
			if (!activeRef.current) return;
			// @ts-expect-error - markdown is added by the extension
			const markdown = editor.storage.markdown.getMarkdown() as string;
			lastContentRef.current = markdown;
			onChangeRef.current(markdown);
		},
		editorProps: {
			attributes: {
				class:
					"prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none p-8 dark:prose-invert",
				style: "font-size: var(--editor-font-size, 16px)",
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

	return (
		<div className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">
			<div className="flex-1 overflow-auto">
				<EditorContent editor={editor} />
			</div>
			<div className="flex h-8 shrink-0 items-center justify-between border-t bg-secondary/10 px-4 text-muted-foreground text-xs">
				<div className="flex gap-4">
					<span>{editor?.storage.characterCount.words()} words</span>
					<span>{editor?.storage.characterCount.characters()} characters</span>
				</div>
				<div>Markdown</div>
			</div>
		</div>
	);
}
