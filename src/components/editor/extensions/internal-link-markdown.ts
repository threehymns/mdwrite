import { Extension } from "@tiptap/core";
import type MarkdownIt from "markdown-it";
import {
	buildInternalLinkHref,
	INTERNAL_LINK_EMBED_PROTOCOL,
	INTERNAL_LINK_PROTOCOL,
	isImageInternalLinkTarget,
	parseInternalLinkBody,
} from "@/lib/internal-links";

const INTERNAL_LINK_FLAG = "__mdwrite_internal_link";

function addInternalLinkRule(md: MarkdownIt) {
	if ((md as any)[INTERNAL_LINK_FLAG]) return;
	(md as any)[INTERNAL_LINK_FLAG] = true;

	const defaultValidateLink = md.validateLink;
	md.validateLink = (url: string) => {
		const trimmed = url.trim();
		if (
			trimmed.startsWith(INTERNAL_LINK_PROTOCOL) ||
			trimmed.startsWith(INTERNAL_LINK_EMBED_PROTOCOL)
		) {
			return true;
		}
		return defaultValidateLink(url);
	};

	const internalLink = (state: any, silent: boolean) => {
		const src = state.src;
		const pos = state.pos;

		// Quick check - if no [[ nearby, skip
		const maxCheck = Math.min(pos + 20, src.length);
		const slice = src.slice(pos, maxCheck);
		if (!slice.includes("[[")) {
			return false;
		}

		let currentPos = pos;
		let embed = false;

		// Check for ![[ (embed)
		if (src.charCodeAt(currentPos) === 0x21) {
			if (
				src.charCodeAt(currentPos + 1) !== 0x5b ||
				src.charCodeAt(currentPos + 2) !== 0x5b
			)
				return false;
			embed = true;
			currentPos += 1;
		}

		// Must start with [[
		if (
			src.charCodeAt(currentPos) !== 0x5b ||
			src.charCodeAt(currentPos + 1) !== 0x5b
		)
			return false;

		const contentStart = currentPos + 2;
		const contentEnd = src.indexOf("]]", contentStart);
		if (contentEnd === -1) return false;

		const body = src.slice(contentStart, contentEnd);
		const parsed = parseInternalLinkBody(body);
		if (!parsed) return false;
		if (silent) return true;

		if (embed && isImageInternalLinkTarget(parsed.target)) {
			const token = state.push("image", "img", 0);
			token.attrs = [
				["src", parsed.target],
				["alt", parsed.display || parsed.target],
				["data-internal-link", "true"],
			];
		} else {
			const href = buildInternalLinkHref(parsed.target, embed);
			const open = state.push("link_open", "a", 1);
			open.attrs = [
				["href", href],
				["data-internal-link", "true"],
			];
			if (embed) {
				open.attrs.push(["data-embed", "true"]);
			}
			const text = state.push("text", "", 0);
			text.content = parsed.display;
			state.push("link_close", "a", -1);
		}

		state.pos = contentEnd + 2;
		return true;
	};

	md.inline.ruler.before("link", "internalLink", internalLink);
}

export const InternalLinkMarkdown = Extension.create({
	name: "internalLinkMarkdown",

	addStorage() {
		return {
			markdown: {
				parse: {
					setup(markdownit: MarkdownIt) {
						addInternalLinkRule(markdownit);
					},
				},
			},
		};
	},
});
