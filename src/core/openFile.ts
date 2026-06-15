import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { decodeAndParseAsync, willUseWorker } from "./parse";
import { actions, nextDocId } from "./store";
import { basename, isTauri } from "./tauri";
import type { Doc } from "./types";

/**
 * The single funnel every entry point converges on (§6): association/CLI launch
 * arg, single-instance forward, drag-and-drop, and File→Open all end here.
 *
 * Mobile (§12) will swap the entry layer (share sheet / document picker) but
 * still call `openBytes` with the file's bytes, so this stays the shared core.
 */
export async function openBytes(
	bytes: Uint8Array,
	meta: { path?: string; name: string },
): Promise<string> {
	const id = nextDocId();
	const doc: Doc = {
		id,
		path: meta.path,
		name: meta.name,
		loading: willUseWorker(bytes.length),
	};
	const docId = actions.addDoc(doc);

	const result = await decodeAndParseAsync(bytes);
	actions.updateDoc(docId, {
		loading: false,
		xml: result.xml,
		invoice: result.invoice,
		error: result.error,
	});

	// Only remember files that actually opened from disk and rendered.
	if (meta.path && result.invoice) {
		actions.rememberRecent({ path: meta.path, name: meta.name, openedAt: epochMs() });
	}
	return docId;
}

/** Read a file from disk by path and open it. Surfaces read errors as a doc. */
export async function openPath(path: string): Promise<string> {
	const name = basename(path);
	if (!isTauri()) {
		// In a plain browser we can't read arbitrary paths; show a clear state.
		const id = actions.addDoc({ id: nextDocId(), path, name });
		actions.updateDoc(id, {
			error: {
				kind: "read-error",
				message: "Reading files by path requires the desktop app.",
			},
		});
		return id;
	}
	let bytes: Uint8Array;
	try {
		bytes = await readFile(path);
	} catch (err) {
		const id = actions.addDoc({ id: nextDocId(), path, name });
		actions.updateDoc(id, {
			error: {
				kind: "read-error",
				message: "This file couldn't be opened. It may have been moved, renamed, or deleted.",
				detail: err instanceof Error ? err.message : String(err),
			},
		});
		return id;
	}
	return openBytes(bytes, { path, name });
}

/** File → Open dialog (§6, point 4). Falls back to an HTML file picker in a
 *  plain browser so `bun run dev` is usable without the native shell. */
export async function openWithDialog(): Promise<void> {
	if (!isTauri()) {
		await pickFilesInBrowser();
		return;
	}
	const selection = await openDialog({
		multiple: true,
		directory: false,
		filters: [
			{ name: "UBL invoice", extensions: ["xml", "ubl"] },
			{ name: "All files", extensions: ["*"] },
		],
	});
	if (!selection) return;
	const paths = Array.isArray(selection) ? selection : [selection];
	for (const path of paths) await openPath(path);
}

/** Open a browser `File` (drag-drop or `<input>`) through the shared funnel. */
export async function openBrowserFile(file: File): Promise<string> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	return openBytes(bytes, { name: file.name });
}

/** Browser-only `<input type="file">` picker used when there's no native dialog. */
function pickFilesInBrowser(): Promise<void> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".xml,.ubl,application/xml,text/xml";
		input.multiple = true;
		input.style.display = "none";
		input.addEventListener("change", async () => {
			const files = Array.from(input.files ?? []);
			for (const file of files) await openBrowserFile(file);
			input.remove();
			resolve();
		});
		// If the dialog is cancelled there's no reliable event; clean up on focus.
		window.addEventListener("focus", () => window.setTimeout(() => input.remove(), 500), {
			once: true,
		});
		document.body.appendChild(input);
		input.click();
	});
}

// `Date.now()` is wrapped so it's trivial to stub in tests if needed.
function epochMs(): number {
	return Date.now();
}
