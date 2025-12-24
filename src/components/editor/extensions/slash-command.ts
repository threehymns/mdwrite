import {
	CodeIcon,
	Heading01Icon,
	Heading02Icon,
	Heading03Icon,
	Image01Icon,
	ListViewIcon,
	Note01Icon,
	QuoteUpIcon,
	Task01Icon,
	TextIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Editor, Range } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionProps } from "@tiptap/suggestion";
import Suggestion from "@tiptap/suggestion";
import React from "react";
import tippy, { type Instance } from "tippy.js";
import { SlashCommandList, type SuggestionItem } from "../slash-command-list";

export const SlashCommand = Extension.create({
	name: "slashCommand",

	addOptions() {
		return {
			onImageUpload: undefined as
				| ((file: File) => Promise<string | null>)
				| undefined,
			suggestion: {
				char: "/",
				command: ({
					editor,
					range,
					props,
				}: {
					editor: Editor;
					range: Range;
					props: { command: (item: SuggestionItem) => void };
				}) => {
					props.command({ editor, range } as any);
				},
			},
		};
	},

	addProseMirrorPlugins() {
		return [
			Suggestion({
				editor: this.editor,
				...this.options.suggestion,
			}),
		];
	},
});

export const suggestion = {
	items: ({ query }: { query: string }): SuggestionItem[] => {
		return [
			{
				title: "Text",
				icon: React.createElement(HugeiconsIcon, { icon: TextIcon, size: 18 }),
				category: "Basic blocks",
				command: ({ editor, range }: { editor: Editor; range: Range }) => {
					editor.chain().focus().deleteRange(range).setParagraph().run();
				},
			},
			{
				title: "Heading 1",
				icon: React.createElement(HugeiconsIcon, {
					icon: Heading01Icon,
					size: 18,
				}),
				category: "Basic blocks",
				shortcut: "#",
				command: ({ editor, range }: { editor: Editor; range: Range }) => {
					editor
						.chain()
						.focus()
						.deleteRange(range)
						.setNode("heading", { level: 1 })
						.run();
				},
			},
			{
				title: "Heading 2",
				icon: React.createElement(HugeiconsIcon, {
					icon: Heading02Icon,
					size: 18,
				}),
				category: "Basic blocks",
				shortcut: "##",
				command: ({ editor, range }: { editor: Editor; range: Range }) => {
					editor
						.chain()
						.focus()
						.deleteRange(range)
						.setNode("heading", { level: 2 })
						.run();
				},
			},
			{
				title: "Heading 3",
				icon: React.createElement(HugeiconsIcon, {
					icon: Heading03Icon,
					size: 18,
				}),
				category: "Basic blocks",
				shortcut: "###",
				command: ({ editor, range }: { editor: Editor; range: Range }) => {
					editor
						.chain()
						.focus()
						.deleteRange(range)
						.setNode("heading", { level: 3 })
						.run();
				},
			},
			{
				title: "Bulleted list",
				icon: React.createElement(HugeiconsIcon, {
					icon: ListViewIcon,
					size: 18,
				}),
				category: "Basic blocks",
				shortcut: "-",
				command: ({ editor, range }: { editor: Editor; range: Range }) => {
					editor.chain().focus().deleteRange(range).toggleBulletList().run();
				},
			},
			{
				title: "Numbered list",
				icon: React.createElement(HugeiconsIcon, {
					icon: Note01Icon,
					size: 18,
				}),
				category: "Basic blocks",
				shortcut: "1.",
				command: ({ editor, range }: { editor: Editor; range: Range }) => {
					editor.chain().focus().deleteRange(range).toggleOrderedList().run();
				},
			},
			{
				title: "To-do list",
				icon: React.createElement(HugeiconsIcon, {
					icon: Task01Icon,
					size: 18,
				}),
				category: "Basic blocks",
				shortcut: "[]",
				command: ({ editor, range }: { editor: Editor; range: Range }) => {
					editor.chain().focus().deleteRange(range).toggleTaskList().run();
				},
			},
			{
				title: "Quote",
				icon: React.createElement(HugeiconsIcon, {
					icon: QuoteUpIcon,
					size: 18,
				}),
				category: "Basic blocks",
				shortcut: ">",
				command: ({ editor, range }: { editor: Editor; range: Range }) => {
					editor.chain().focus().deleteRange(range).toggleBlockquote().run();
				},
			},
			{
				title: "Code Block",
				icon: React.createElement(HugeiconsIcon, { icon: CodeIcon, size: 18 }),
				category: "Basic blocks",
				shortcut: "```",
				command: ({ editor, range }: { editor: Editor; range: Range }) => {
					editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
				},
			},
			{
				title: "Image (Upload)",
				icon: React.createElement(HugeiconsIcon, {
					icon: Image01Icon,
					size: 18,
				}),
				category: "Basic blocks",
				command: ({ editor, range }: { editor: Editor; range: Range }) => {
					editor.chain().focus().deleteRange(range).run();
					const input = document.createElement("input");
					input.type = "file";
					input.accept = "image/*";
					input.onchange = async () => {
						if (input.files?.length) {
							const file = input.files[0];
							const onImageUpload = editor.extensionManager.extensions.find(
								(e) => e.name === "slashCommand",
							)?.options.onImageUpload;

							if (onImageUpload) {
								const url = await onImageUpload(file);
								if (url) {
									editor.chain().focus().setImage({ src: url }).run();
								}
							} else {
								const reader = new FileReader();
								reader.onload = (e) => {
									const src = e.target?.result as string;
									editor.chain().focus().setImage({ src }).run();
								};
								reader.readAsDataURL(file);
							}
						}
					};
					input.click();
				},
			},
			{
				title: "Image (URL)",
				icon: React.createElement(HugeiconsIcon, {
					icon: Image01Icon,
					size: 18,
				}),
				category: "Basic blocks",
				command: ({ editor, range }: { editor: Editor; range: Range }) => {
					const url = prompt("Enter image URL");
					if (url) {
						editor
							.chain()
							.focus()
							.deleteRange(range)
							.setImage({ src: url })
							.run();
					}
				},
			},
		]
			.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()))
			.slice(0, 10);
	},

	render: () => {
		let component: ReactRenderer<{
			onKeyDown: (props: { event: KeyboardEvent }) => boolean;
		}>;
		let popup: Instance[];
		let editor: Editor;
		let initialRange: Range;

		return {
			onStart: (props: SuggestionProps) => {
				editor = props.editor;
				initialRange = props.range;
				component = new ReactRenderer(SlashCommandList as any, {
					props,
					editor: props.editor,
				});

				if (!props.clientRect) {
					return;
				}

				popup = tippy("body", {
					getReferenceClientRect: props.clientRect as any,
					appendTo: () => document.body,
					content: component.element,
					showOnCreate: true,
					interactive: true,
					trigger: "manual",
					placement: "bottom-start",
				}) as Instance[];
			},

			onUpdate(props: SuggestionProps) {
				component.updateProps(props);

				if (!props.clientRect) {
					return;
				}

				popup[0].setProps({
					getReferenceClientRect: props.clientRect as any,
				});
			},

			onKeyDown(props: { event: KeyboardEvent }) {
				if (props.event.key === "Escape") {
					popup[0].hide();
					const currentRange = editor.state.selection.from;
					editor
						.chain()
						.focus()
						.deleteRange({ from: initialRange.from, to: currentRange })
						.run();
					return true;
				}

				return component.ref?.onKeyDown(props) ?? false;
			},

			onExit() {
				popup[0].destroy();
				component.destroy();
			},
		};
	},
};
