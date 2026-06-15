import { UblInvoice, type UblInvoiceData } from "@financica/react-ubl-renderer";
import { useEffect, useRef } from "react";
import { clearHighlights, highlightMatches } from "../core/search";
import { actions, useSelector } from "../core/store";
import { NotAnInvoice } from "./ErrorState";

/**
 * The rendered invoice surface. The renderer library does all the layout; our
 * job is zoom, search highlighting, and a sensible fallback. All invoice text
 * is React-escaped by the renderer — we never inject raw strings (§11).
 */
export function InvoiceView({ invoice }: { invoice: UblInvoiceData }) {
	const zoom = useSelector((s) => s.zoom);
	const search = useSelector((s) => s.search);
	const containerRef = useRef<HTMLDivElement>(null);

	// Re-highlight whenever the query, search visibility, or document changes.
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-run on invoice swap
	useEffect(() => {
		const root = containerRef.current;
		if (!root) return;
		const { count } = highlightMatches(root, search.open ? search.query : "");
		actions.setSearchCount(count);
		return () => clearHighlights();
	}, [search.open, search.query, invoice]);

	return (
		<div
			className="invoice-scroll"
			ref={containerRef}
			// `zoom` reflows the document cleanly in Chromium/WebView2 (unlike a
			// transform), so fit-to-width and scrolling stay correct.
			style={{ zoom }}
		>
			<UblInvoice invoice={invoice} locale={navigator.language} fallback={<NotAnInvoice />} />
		</div>
	);
}
