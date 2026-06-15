import { useSelector } from "../core/store";
import type { Doc } from "../core/types";
import { ErrorState } from "./ErrorState";
import { InvoiceView } from "./InvoiceView";
import { RawXmlView } from "./RawXmlView";

/** Renders a single active document in its current view mode. */
export function DocumentView({ doc }: { doc: Doc }) {
	const viewMode = useSelector((s) => s.viewModes[doc.id] ?? "rendered");

	if (doc.loading) {
		return (
			<div className="state state--loading" aria-busy="true">
				<div className="spinner" aria-hidden="true" />
				<p className="state__message">Opening {doc.name}…</p>
			</div>
		);
	}

	// Raw XML view (explicit toggle, or the escape hatch from an error).
	if (viewMode === "raw" && typeof doc.xml === "string") {
		return <RawXmlView xml={doc.xml} />;
	}

	if (doc.invoice) {
		return <InvoiceView invoice={doc.invoice} />;
	}

	return <ErrorState doc={doc} />;
}
