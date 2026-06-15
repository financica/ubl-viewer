import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect } from "react";
import { openBrowserFile, openPath } from "../core/openFile";
import { actions } from "../core/store";
import { isTauri } from "../core/tauri";

/**
 * Wires every desktop entry point (§6) into the shared `openPath` funnel:
 *
 *   1. Launch-time file — double-click in Explorer (file association) or CLI
 *      `ubl-viewer invoice.xml` on first start. The Rust side stashed the path;
 *      we pull it once with the `take_launch_file` command.
 *   2. Subsequent double-clicks — a second launch is forwarded by the
 *      single-instance plugin as an `open-file` event to this running instance.
 *   3. Drag-and-drop onto the window.
 *
 * Outside Tauri (browser/tests) this is inert.
 */
export function useFileOpening(): void {
	useEffect(() => {
		// Browser fallback (plain `bun run dev`): use HTML drag-and-drop so the app
		// is usable without the native shell. The desktop wiring below is inert here.
		if (!isTauri()) return wireBrowserDragDrop();

		let disposed = false;

		// 1. Launch-time file (double-click / CLI on first start).
		invoke<string | null>("take_launch_file")
			.then((p) => {
				if (!disposed && p) void openPath(p);
			})
			.catch(() => {
				/* no launch file — normal start */
			});

		// 2. Subsequent double-clicks routed here by single-instance forwarding.
		const offOpen = listen<string>("open-file", (event) => {
			if (event.payload) void openPath(event.payload);
		});

		// 3. Drag-and-drop (with a drop-overlay driven by enter/leave).
		const offDrop = getCurrentWebview().onDragDropEvent((event) => {
			switch (event.payload.type) {
				case "enter":
				case "over":
					actions.setDragging(true);
					break;
				case "leave":
					actions.setDragging(false);
					break;
				case "drop":
					actions.setDragging(false);
					for (const path of event.payload.paths) void openPath(path);
					break;
			}
		});

		return () => {
			disposed = true;
			void offOpen.then((f) => f());
			void offDrop.then((f) => f());
		};
	}, []);
}

/** HTML drag-and-drop on the window, for the browser dev fallback. */
function wireBrowserDragDrop(): () => void {
	const onDragOver = (e: DragEvent) => {
		e.preventDefault();
		actions.setDragging(true);
	};
	const onDragLeave = (e: DragEvent) => {
		// Only clear when leaving the window, not when moving between children.
		if (e.relatedTarget === null) actions.setDragging(false);
	};
	const onDrop = (e: DragEvent) => {
		e.preventDefault();
		actions.setDragging(false);
		for (const file of Array.from(e.dataTransfer?.files ?? [])) void openBrowserFile(file);
	};
	window.addEventListener("dragover", onDragOver);
	window.addEventListener("dragleave", onDragLeave);
	window.addEventListener("drop", onDrop);
	return () => {
		window.removeEventListener("dragover", onDragOver);
		window.removeEventListener("dragleave", onDragLeave);
		window.removeEventListener("drop", onDrop);
	};
}
