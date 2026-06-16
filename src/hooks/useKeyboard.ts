import { useEffect } from "react";
import { actions, activeDoc } from "../core/store";
import { useStore } from "../core/store";

/**
 * In-page keyboard shortcuts (§9). Uses Ctrl on Windows/Linux and ⌘ on macOS.
 *
 *   Ctrl/⌘ + F           Find in document
 *   Ctrl/⌘ + R           Toggle raw XML
 *   Ctrl/⌘ + + / - / 0   Zoom in / out / reset
 *   Ctrl/⌘ + Tab         Next tab   (Ctrl/⌘ + Shift + Tab = previous)
 *   Escape               Close find
 *
 * Open (Ctrl+O), Close Tab (Ctrl+W) and Print (Ctrl+P) are owned by the native
 * application menu / the system print accelerator (see hooks/useMenu.ts), so
 * they are intentionally NOT handled here — duplicating them would fire twice.
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
