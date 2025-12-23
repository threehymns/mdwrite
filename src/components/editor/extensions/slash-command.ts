import type { Editor, Range } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionProps } from "@tiptap/suggestion";
import Suggestion from "@tiptap/suggestion";
import {
	Code,
	Heading1,
	Heading2,
	Heading3,
	Image as ImageIcon,
	List,
	ListOrdered,
	Quote,
	Type,
} from "lucide-react";
import React from "react";
import tippy, { type Instance } from "tippy.js";
import { SlashCommandList, type SuggestionItem } from "../slash-command-list";

export const SlashCommand = Extension.create({
	name: "slashCommand",

	addOptions() {
		return {
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
				description: "Just start typing with plain text.",
				icon: React.createElement(Type, { size: 18 }),
				command: ({ editor, range }: { editor: Editor; range: Range }) => {
					editor.chain().focus().deleteRange(range).setParagraph().run();
				},
			},
			{
				title: "Heading 1",
				description: "Big section heading.",
				icon: React.createElement(Heading1, { size: 18 }),
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
				description: "Medium section heading.",
				icon: React.createElement(Heading2, { size: 18 }),
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
				description: "Small section heading.",
				icon: React.createElement(Heading3, { size: 18 }),
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
				title: "Bullet List",
				description: "Create a simple bullet list.",
				icon: React.createElement(List, { size: 18 }),
				command: ({ editor, range }: { editor: Editor; range: Range }) => {
					editor.chain().focus().deleteRange(range).toggleBulletList().run();
				},
			},
			{
				title: "Numbered List",
				description: "Create a list with numbering.",
				icon: React.createElement(ListOrdered, { size: 18 }),
				command: ({ editor, range }: { editor: Editor; range: Range }) => {
					editor.chain().focus().deleteRange(range).toggleOrderedList().run();
				},
			},
			{
				title: "Quote",
				description: "Capture a quotation.",
				icon: React.createElement(Quote, { size: 18 }),
				command: ({ editor, range }: { editor: Editor; range: Range }) => {
					editor.chain().focus().deleteRange(range).toggleBlockquote().run();
				},
			},
			{
				title: "Code Block",
				description: "Capture a code snippet.",
				icon: React.createElement(Code, { size: 18 }),
				command: ({ editor, range }: { editor: Editor; range: Range }) => {
					editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
				},
			},
			{
				title: "Image",
				description: "Upload an image.",
				icon: React.createElement(ImageIcon, { size: 18 }),
				command: ({ editor, range }: { editor: Editor; range: Range }) => {
					editor.chain().focus().deleteRange(range).run();
					const input = document.createElement("input");
					input.type = "file";
					input.accept = "image/*";
					input.onchange = async () => {
						if (input.files?.length) {
							const file = input.files[0];
							console.log("Image upload requested from slash command", file);
						}
					};
					input.click();
				},
			},
		]
			.filter((item) =>
				item.title.toLowerCase().startsWith(query.toLowerCase()),
			)
			.slice(0, 10);
	},

	render: () => {
		let component: ReactRenderer<{
			onKeyDown: (props: { event: KeyboardEvent }) => boolean;
		}>;
		let popup: Instance[];

		return {
			onStart: (props: SuggestionProps) => {
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
