import { actions } from "../core/store";
import type { Doc, DocError } from "../core/types";

const ICONS: Record<DocError["kind"], string> = {
	"not-ubl": "📄",
	"parse-error": "⚠️",
	"read-error": "🚫",
	empty: "🗋",
};

const TITLES: Record<DocError["kind"], string> = {
	"not-ubl": "Not a UBL invoice",
	"parse-error": "Couldn't read this document",
	"read-error": "Couldn't open this file",
	empty: "Empty file",
};

/**
 * Shown whenever a document can't be rendered as an invoice (§9). Always gives a
 * plain-language explanation and, when we managed to decode the text, a "View
 * raw XML" escape hatch — never a blank screen or a crash.
 */
export function ErrorState({ doc }: { doc: Doc }) {
	const error = doc.error;
	if (!error) return null;
	const canViewRaw = typeof doc.xml === "string" && doc.xml.length > 0;

	return (
		<div className="state state--error" role="alert">
			<div className="state__icon" aria-hidden="true">
				{ICONS[error.kind]}
			</div>
			<h2 className="state__title">{TITLES[error.kind]}</h2>
			<p className="state__message">{error.message}</p>
			{error.detail && <pre className="state__detail">{error.detail}</pre>}
			<div className="state__actions">
				{canViewRaw && (
					<button
						type="button"
						className="button"
						onClick={() => actions.setViewMode(doc.id, "raw")}
					>
						View raw XML
					</button>
				)}
				<button
					type="button"
					className="button button--ghost"
					onClick={() => actions.closeDoc(doc.id)}
				>
					Close
				</button>
			</div>
		</div>
	);
}

/** Fallback passed to the renderer when its own parse step rejects the input. */
export function NotAnInvoice() {
	return (
		<div className="state state--error" role="alert">
			<div className="state__icon" aria-hidden="true">
				📄
			</div>
			<h2 className="state__title">Not a UBL invoice</h2>
			<p className="state__message">
				This document isn't an invoice or credit note this app can display.
			</p>
		</div>
	);
}
