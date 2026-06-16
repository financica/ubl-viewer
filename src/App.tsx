import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useState } from "react";
import { AttachmentsBar } from "./components/AttachmentsBar";
import { DocumentView } from "./components/DocumentView";
import { EmptyState } from "./components/EmptyState";
import { SearchBar } from "./components/SearchBar";
import { TabBar } from "./components/TabBar";
import { Toolbar } from "./components/Toolbar";
import { activeDoc, useSelector, useStore } from "./core/store";
import { isTauri } from "./core/tauri";
import { useTheme } from "./core/theme";
import { useFileOpening } from "./hooks/useFileOpening";
import { useKeyboard } from "./hooks/useKeyboard";
import { useMenu } from "./hooks/useMenu";

const APP_NAME = "UBL Viewer";

export default function App() {
	const state = useStore();
	const doc = activeDoc(state);
	const [aboutOpen, setAboutOpen] = useState(false);

	useFileOpening();
	useKeyboard();
	useTheme(); // apply theme to <html> even when the toolbar isn't mounted
	useMenu(useCallback(() => setAboutOpen(true), []));

	useWindowTitle(doc?.invoice?.documentType, doc?.name, doc?.invoice?.id);

	return (
		<div className="app">
			<Toolbar />
			<TabBar />
			<SearchBar />
			{doc?.invoice?.attachments && doc.invoice.attachments.length > 0 && (
				<AttachmentsBar attachments={doc.invoice.attachments} />
			)}
			<main className="app__body">{doc ? <DocumentView doc={doc} /> : <EmptyState />}</main>
			<DropOverlay />
			{aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
		</div>
	);
}

function DropOverlay() {
	const dragging = useSelector((s) => s.dragging);
	if (!dragging) return null;
	return (
		<div className="drop-overlay" aria-hidden="true">
			<div className="drop-overlay__box">Drop to open</div>
		</div>
	);
}

function AboutDialog({ onClose }: { onClose: () => void }) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	return (
		<div className="preview-overlay" role="dialog" aria-modal="true" aria-label="About UBL Viewer">
			<div className="about">
				<div className="state__icon state__icon--brand" aria-hidden="true">
					🧾
				</div>
				<h2 className="state__title">UBL Viewer</h2>
				<p className="state__message">
					A fast, private viewer for UBL e-invoices and credit notes (Peppol BIS Billing 3.0 / EN
					16931). Everything is parsed and rendered on-device.
				</p>
				<p className="about__meta">Ingram Technologies · MIT licensed</p>
				<button type="button" className="button button--primary" onClick={onClose}>
					Close
				</button>
			</div>
		</div>
	);
}

/** Reflect the open document in the OS window title (§9 chrome). */
function useWindowTitle(type?: "Invoice" | "CreditNote", name?: string, id?: string) {
	useEffect(() => {
		const label = type
			? `${type === "CreditNote" ? "Credit note" : "Invoice"} ${id ?? ""}`.trim()
			: name;
		const title = label ? `${label} — ${APP_NAME}` : APP_NAME;
		document.title = title;
		if (isTauri()) {
			getCurrentWindow()
				.setTitle(title)
				.catch(() => {
					/* window may not be ready yet */
				});
		}
	}, [type, name, id]);
}
