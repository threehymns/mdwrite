import type { ImageOptions } from "@tiptap/extension-image";
import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageNodeView } from "./image-node-view";

export interface ImageWithResolverOptions extends ImageOptions {
	resolveImagePath?: (path: string) => Promise<string | null>;
}

export const ImageWithResolver = Image.extend<ImageWithResolverOptions>({
	addOptions() {
		return {
			...this.parent?.(),
			resolveImagePath: undefined,
		} as any;
	},

	addNodeView() {
		return ReactNodeViewRenderer(ImageNodeView);
	},
});
