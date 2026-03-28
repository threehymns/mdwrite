import type { ImageOptions } from "@tiptap/extension-image";
import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { defaultMarkdownSerializer } from "prosemirror-markdown";
import { ImageNodeView } from "./image-node-view";

export interface ImageWithResolverOptions extends ImageOptions {
	resolveImagePath?: (path: string) => Promise<string | null>;
}

export const ImageWithResolver = Image.extend<ImageWithResolverOptions>({
	addOptions() {
		return {
			...this.parent?.(),
			resolveImagePath: undefined,
			// biome-ignore lint/suspicious/noExplicitAny: Parent options typing is complex
		} as any;
	},

	addAttributes() {
		return {
			...this.parent?.(),
			internalLink: {
				default: false,
				parseHTML: (element) =>
					element.getAttribute("data-internal-link") === "true",
				renderHTML: (attributes) =>
					attributes.internalLink ? { "data-internal-link": "true" } : {},
			},
		};
	},

	addStorage() {
		return {
			markdown: {
				serialize(state, node) {
					if (node.attrs.internalLink) {
						const alt = node.attrs.alt?.trim();
						const needsAlias = alt && alt.length > 0 && alt !== node.attrs.src;
						const inner = needsAlias
							? `${node.attrs.src}|${alt}`
							: node.attrs.src;
						state.write(`![[${inner}]]`);
						return;
					}
					defaultMarkdownSerializer.nodes.image(state, node);
				},
				parse: {
					// handled by markdown-it
				},
			},
		};
	},

	addNodeView() {
		return ReactNodeViewRenderer(ImageNodeView);
	},
});
