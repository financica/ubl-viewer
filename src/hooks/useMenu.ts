import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { openWithDialog } from "../core/openFile";
import { printInvoice } from "../core/print";
import { actions, activeDoc, getState } from "../core/store";
import { isTauri } from "../core/tauri";

/**
 * Bridges the native application menu (built in src-tauri/src/lib.rs) to the
 * frontend: each menu item emits a `menu` event carrying its id, and we run the
 * matching action here. This keeps a single source of truth for what each
 * command does, shared with the toolbar and keyboard.
 */
export function useMenu(onAbout: () => void): void {
	useEffect(() => {
		if (!isTauri()) return;
		const off = listen<string>("menu", (event) => {
			const state = getState();
			const doc = activeDoc(state);
			switch (event.payload) {
				case "open":
					void openWithDialog();
					break;
				case "close":
					if (state.activeId) actions.closeDoc(state.activeId);
					break;
				case "print":
					printInvoice();
					break;
				case "find":
					if (doc?.invoice) actions.openSearch();
					break;
				case "raw":
					if (doc?.xml) actions.toggleRaw();
					break;
				case "zoom-in":
					actions.zoomIn();
					break;
				case "zoom-out":
					actions.zoomOut();
					break;
				case "zoom-reset":
					actions.zoomReset();
					break;
				case "about":
					onAbout();
					break;
			}
		});
		return () => {
			void off.then((f) => f());
		};
	}, [onAbout]);
}
