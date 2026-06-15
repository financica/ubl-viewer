/**
 * In-document search highlighting (§9). Uses the CSS Custom Highlight API
 * (`CSS.highlights`) which paints ranges *without mutating the DOM* — important
 * because the invoice markup is owned by the renderer/React, and wrapping text
 * nodes in `<mark>` would fight reconciliation. WebView2 (Chromium) supports it;
 * where it's unavailable (e.g. jsdom in tests) this degrades to a no-op that
 * still reports the match count.
 */

const HIGHLIGHT_NAME = "ubl-search";

export interface HighlightResult {
	count: number;
}

interface HighlightApi {
	highlights: Map<string, unknown>;
}

// `Highlight` and `CSS.highlights` aren't in every TS DOM lib version; reach
// them through globalThis so this compiles regardless of target lib.
function highlightCtor(): (new (...ranges: Range[]) => unknown) | null {
	const ctor = (globalThis as Record<string, unknown>).Highlight;
	return typeof ctor === "function" ? (ctor as new (...ranges: Range[]) => unknown) : null;
}

function highlightApi(): HighlightApi | null {
	const css = (globalThis as { CSS?: unknown }).CSS as HighlightApi | undefined;
	if (css?.highlights && highlightCtor()) return css;
	return null;
}

/** Collects every text node under `root` in document order. */
function textNodes(root: Node): Text[] {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const nodes: Text[] = [];
	let node = walker.nextNode();
	while (node) {
		if (node.nodeValue && node.nodeValue.trim().length > 0) nodes.push(node as Text);
		node = walker.nextNode();
	}
	return nodes;
}

/** Find every case-insensitive match of `query` in a string. */
function matchOffsets(haystack: string, needle: string): number[] {
	if (!needle) return [];
	const offsets: number[] = [];
	const hay = haystack.toLowerCase();
	const ned = needle.toLowerCase();
	let from = 0;
	let idx = hay.indexOf(ned, from);
	while (idx !== -1) {
		offsets.push(idx);
		from = idx + ned.length;
		idx = hay.indexOf(ned, from);
	}
	return offsets;
}

/**
 * Highlight all matches of `query` within `root`, returning the match count and
 * scrolling the first match into view. Returns 0 and clears highlights for an
 * empty query.
 */
export function highlightMatches(root: HTMLElement, query: string): HighlightResult {
	const api = highlightApi();
	const ranges: Range[] = [];

	if (query) {
		for (const node of textNodes(root)) {
			const value = node.nodeValue ?? "";
			for (const offset of matchOffsets(value, query)) {
				const range = document.createRange();
				range.setStart(node, offset);
				range.setEnd(node, offset + query.length);
				ranges.push(range);
			}
		}
	}

	if (api) {
		const Ctor = highlightCtor();
		if (ranges.length > 0 && Ctor) {
			api.highlights.set(HIGHLIGHT_NAME, new Ctor(...ranges));
		} else {
			api.highlights.delete(HIGHLIGHT_NAME);
		}
	}

	if (ranges.length > 0) {
		const first = ranges[0].startContainer.parentElement;
		first?.scrollIntoView({ block: "center", behavior: "smooth" });
	}

	return { count: ranges.length };
}

export function clearHighlights(): void {
	const api = highlightApi();
	api?.highlights.delete(HIGHLIGHT_NAME);
}
