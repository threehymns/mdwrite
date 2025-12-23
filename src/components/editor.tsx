import CharacterCount from "@tiptap/extension-character-count";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import * as React from "react";
import { Markdown } from "tiptap-markdown";
import { CodeBlockCodeMirror } from "./editor/extensions/code-block-codemirror";
import { SlashCommand, suggestion } from "./editor/extensions/slash-command";

interface EditorProps {
	content: string;
	onChange: (content: string) => void;
	onImageUpload?: (file: File) => Promise<string | null>;
}

export interface EditorHandle {
	scrollToHeading: (text: string, level: number) => void;
}

export function Editor({
	content,
	onChange,
	onImageUpload,
	editorRef,
}: EditorProps & { editorRef?: React.RefObject<EditorHandle | null> }) {
	const lastContentRef = React.useRef(content);

	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				codeBlock: false,
			}),
			CodeBlockCodeMirror,
			Image.configure({
				allowBase64: true,
			}),
			Markdown,
			Placeholder.configure({
				placeholder: "Start writing...",
			}),
			CharacterCount,
			SlashCommand.configure({
				suggestion,
			}),
		],
		content,
		onUpdate: ({ editor }) => {
			// @ts-expect-error - markdown is added by the extension
			const markdown = editor.storage.markdown.getMarkdown() as string;
			lastContentRef.current = markdown;
			onChange(markdown);
		},
		editorProps: {
			attributes: {
				class:
					"prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none p-8 dark:prose-invert",
				style: "font-size: var(--editor-font-size, 16px)",
			},
			handleDrop(view, event, _slice, moved) {
				if (
					!moved &&
					event.dataTransfer &&
					event.dataTransfer.files &&
					event.dataTransfer.files[0]
				) {
					const file = event.dataTransfer.files[0];
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
		if (editor && content !== lastContentRef.current) {
			editor.commands.setContent(content);
			lastContentRef.current = content;
		}
	}, [content, editor]);

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
