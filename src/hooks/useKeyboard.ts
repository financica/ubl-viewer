import { useEffect } from "react";
import { openWithDialog } from "../core/openFile";
import { printInvoice } from "../core/print";
import { actions, activeDoc } from "../core/store";
import { useStore } from "../core/store";

/**
 * Global keyboard shortcuts (§9). Uses Ctrl on Windows/Linux and ⌘ on macOS.
 *
 *   Ctrl/⌘ + O           Open…
 *   Ctrl/⌘ + W           Close tab
 *   Ctrl/⌘ + P           Print / export PDF
 *   Ctrl/⌘ + F           Find in document
 *   Ctrl/⌘ + R           Toggle raw XML
 *   Ctrl/⌘ + + / - / 0   Zoom in / out / reset
 *   Ctrl/⌘ + Tab         Next tab   (Ctrl/⌘ + Shift + Tab = previous)
 *   Escape               Close find
 */
export function useKeyboard(): void {
	const state = useStore();

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const mod = e.ctrlKey || e.metaKey;

			if (e.key === "Escape" && state.search.open) {
				actions.closeSearch();
				return;
			}
			if (!mod) return;

			switch (e.key.toLowerCase()) {
				case "o":
					e.preventDefault();
					void openWithDialog();
					return;
				case "w": {
					if (state.activeId) {
						e.preventDefault();
						actions.closeDoc(state.activeId);
					}
					return;
				}
				case "p": {
					const doc = activeDoc(state);
					if (doc?.invoice) {
						e.preventDefault();
						printInvoice(doc.invoice);
					}
					return;
				}
				case "f": {
					const doc = activeDoc(state);
					if (doc?.invoice) {
						e.preventDefault();
						actions.openSearch();
					}
					return;
				}
				case "r": {
					const doc = activeDoc(state);
					if (doc?.xml) {
						e.preventDefault();
						actions.toggleRaw();
					}
					return;
				}
				case "=":
				case "+":
					e.preventDefault();
					actions.zoomIn();
					return;
				case "-":
					e.preventDefault();
					actions.zoomOut();
					return;
				case "0":
					e.preventDefault();
					actions.zoomReset();
					return;
				case "tab":
					e.preventDefault();
					actions.cycleTab(e.shiftKey ? -1 : 1);
					return;
			}
		}

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [state]);
}
