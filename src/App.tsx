import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
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

const APP_NAME = "UBL Viewer";

export default function App() {
	const state = useStore();
	const doc = activeDoc(state);

	useFileOpening();
	useKeyboard();
	useTheme(); // apply theme to <html> even when the toolbar isn't mounted

	useWindowTitle(doc?.invoice?.documentType, doc?.name, doc?.invoice?.id);

	return (
		<div className="app">
			<Toolbar />
			<TabBar />
			<SearchBar />
			<main className="app__body">{doc ? <DocumentView doc={doc} /> : <EmptyState />}</main>
			<DropOverlay />
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
