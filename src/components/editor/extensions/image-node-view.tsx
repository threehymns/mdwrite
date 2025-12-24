import { type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useEffect, useState } from "react";

export const ImageNodeView = (props: NodeViewProps) => {
	const { node, extension } = props;
	const [src, setSrc] = useState<string>(node.attrs.src);
	const resolveImagePath = (extension.options as any).resolveImagePath;

	useEffect(() => {
		let isMounted = true;
		const originalSrc = node.attrs.src;
		let objectUrl: string | null = null;

		if (resolveImagePath && originalSrc) {
			resolveImagePath(originalSrc).then((resolved: string | null) => {
				if (!isMounted) {
					if (resolved?.startsWith("blob:")) {
						URL.revokeObjectURL(resolved);
					}
					return;
				}

				if (resolved) {
					if (resolved.startsWith("blob:")) {
						objectUrl = resolved;
					}
					setSrc(resolved);
				}
			});
		} else {
			setSrc(originalSrc);
		}

		return () => {
			isMounted = false;
			if (objectUrl) {
				URL.revokeObjectURL(objectUrl);
			}
		};
	}, [node.attrs.src, resolveImagePath]);

	return (
		<NodeViewWrapper className="image-node-view inline-block">
			<img
				src={src}
				alt={node.attrs.alt}
				title={node.attrs.title}
				className={node.attrs.class}
				style={{
					maxWidth: "100%",
					height: "auto",
					display: "block",
				}}
			/>
		</NodeViewWrapper>
	);
};
