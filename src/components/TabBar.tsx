import { actions, useSelector } from "../core/store";
import type { Doc } from "../core/types";

/** Document tabs (§9 multi-document). Hidden when only one document is open. */
export function TabBar() {
	const docs = useSelector((s) => s.docs);
	const activeId = useSelector((s) => s.activeId);

	if (docs.length <= 1) return null;

	return (
		<div className="tabbar" role="tablist" aria-label="Open documents">
			{docs.map((doc) => (
				<Tab key={doc.id} doc={doc} active={doc.id === activeId} />
			))}
		</div>
	);
}

function Tab({ doc, active }: { doc: Doc; active: boolean }) {
	const label = doc.invoice?.documentType === "CreditNote" ? "Credit note" : doc.name;
	return (
		<div className={`tab ${active ? "tab--active" : ""}`} role="presentation">
			<button
				type="button"
				role="tab"
				aria-selected={active}
				className="tab__label"
				title={doc.path ?? doc.name}
				onClick={() => actions.setActive(doc.id)}
			>
				{doc.invoice && (
					<span className="tab__badge" aria-hidden="true">
						{doc.invoice.documentType === "CreditNote" ? "CN" : "INV"}
					</span>
				)}
				<span className="tab__name">{label}</span>
			</button>
			<button
				type="button"
				className="tab__close"
				aria-label={`Close ${doc.name}`}
				onClick={(e) => {
					e.stopPropagation();
					actions.closeDoc(doc.id);
				}}
			>
				✕
			</button>
		</div>
	);
}
