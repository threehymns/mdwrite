export const INTERNAL_LINK_PROTOCOL = "internal-link:";
export const INTERNAL_LINK_EMBED_PROTOCOL = "internal-link-embed:";

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

export interface InternalLinkBody {
	target: string;
	display: string;
	hasAlias: boolean;
}

export function parseInternalLinkBody(body: string): InternalLinkBody | null {
	const trimmed = body.trim();
	if (!trimmed) return null;

	const pipeIndex = trimmed.indexOf("|");
	if (pipeIndex === -1) {
		return { target: trimmed, display: trimmed, hasAlias: false };
	}

	const target = trimmed.slice(0, pipeIndex).trim();
	if (!target) return null;
	const display = trimmed.slice(pipeIndex + 1).trim();

	return { target, display: display || target, hasAlias: true };
}

export function buildInternalLinkHref(target: string, embed: boolean): string {
	const encoded = encodeURIComponent(target);
	return `${embed ? INTERNAL_LINK_EMBED_PROTOCOL : INTERNAL_LINK_PROTOCOL}${encoded}`;
}

export function parseInternalLinkHref(
	href: string,
): { target: string; embed: boolean } | null {
	if (href.startsWith(INTERNAL_LINK_PROTOCOL)) {
		return {
			target: safeDecodeURIComponent(href.slice(INTERNAL_LINK_PROTOCOL.length)),
			embed: false,
		};
	}

	if (href.startsWith(INTERNAL_LINK_EMBED_PROTOCOL)) {
		return {
			target: safeDecodeURIComponent(
				href.slice(INTERNAL_LINK_EMBED_PROTOCOL.length),
			),
			embed: true,
		};
	}

	return null;
}

function safeDecodeURIComponent(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

export function stripInternalLinkAnchor(target: string): string {
	const trimmed = target.trim();
	if (!trimmed || trimmed.startsWith("#")) return "";
	const hashIndex = trimmed.indexOf("#");
	return hashIndex === -1 ? trimmed : trimmed.slice(0, hashIndex);
}

export function isImageInternalLinkTarget(target: string): boolean {
	const base = target.split("#")[0].split("?")[0];
	return IMAGE_EXT_RE.test(base);
}

const INTERNAL_LINK_MARKDOWN_RE =
	/\[([^\]]*?)\]\((internal-link(?:-embed)?:[^)]+)\)/g;

function replaceInternalLinksInSegment(segment: string): string {
	return segment.replace(
		INTERNAL_LINK_MARKDOWN_RE,
		(match, text, href: string) => {
			const parsed = parseInternalLinkHref(href);
			if (!parsed) return match;

			const display = String(text ?? "");
			const needsAlias = display.length > 0 && display !== parsed.target;
			const inner = needsAlias ? `${parsed.target}|${display}` : parsed.target;
			return `${parsed.embed ? "!" : ""}[[${inner}]]`;
		},
	);
}

export function serializeInternalLinkMarkdown(markdown: string): string {
	const lines = markdown.split("\n");
	const output: string[] = [];
	let buffer = "";
	let inFence = false;
	let fenceChar = "";
	let fenceLen = 0;

	const flushBuffer = () => {
		if (!buffer) return;
		output.push(replaceInternalLinksInSegment(buffer));
		buffer = "";
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})/);
		const isLast = i === lines.length - 1;
		const lineOut = isLast ? line : `${line}\n`;

		if (fenceMatch) {
			const marker = fenceMatch[2];
			if (!inFence) {
				flushBuffer();
				inFence = true;
				fenceChar = marker[0];
				fenceLen = marker.length;
				output.push(lineOut);
			} else if (marker[0] === fenceChar && marker.length >= fenceLen) {
				inFence = false;
				output.push(lineOut);
			} else {
				output.push(lineOut);
			}
			continue;
		}

		if (inFence) {
			output.push(lineOut);
		} else {
			buffer += lineOut;
		}
	}

	flushBuffer();
	return output.join("");
}

const WIKI_LINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const WIKI_EMBED_RE = /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export function parseInternalLinkMarkdown(markdown: string): string {
	const lines = markdown.split("\n");
	const output: string[] = [];
	let buffer = "";
	let inFence = false;
	let fenceChar = "";
	let fenceLen = 0;

	const flushBuffer = () => {
		if (!buffer) return;
		let processed = buffer;
		processed = processed.replace(WIKI_EMBED_RE, (_match, target, display) => {
			const href = buildInternalLinkHref(target.trim(), true);
			const displayText = display?.trim() || target.trim();
			return `![${displayText}](${href})`;
		});
		processed = processed.replace(WIKI_LINK_RE, (_match, target, display) => {
			const href = buildInternalLinkHref(target.trim(), false);
			const displayText = display?.trim() || target.trim();
			return `[${displayText}](${href})`;
		});
		output.push(processed);
		buffer = "";
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})/);
		const isLast = i === lines.length - 1;
		const lineOut = isLast ? line : `${line}\n`;

		if (fenceMatch) {
			const marker = fenceMatch[2];
			if (!inFence) {
				flushBuffer();
				inFence = true;
				fenceChar = marker[0];
				fenceLen = marker.length;
				output.push(lineOut);
			} else if (marker[0] === fenceChar && marker.length >= fenceLen) {
				inFence = false;
				output.push(lineOut);
			} else {
				output.push(lineOut);
			}
			continue;
		}

		if (inFence) {
			output.push(lineOut);
		} else {
			buffer += lineOut;
		}
	}

	flushBuffer();
	return output.join("");
}
