/**
 * Tiny environment shim. The app runs inside Tauri's webview in production, but
 * also in a plain browser (Vite dev without `tauri dev`) and under jsdom (tests).
 * Native calls are guarded behind `isTauri()` so the same code paths work
 * everywhere.
 */
export function isTauri(): boolean {
	return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Basename of a path using either separator, without Node's `path` module. */
export function basename(p: string): string {
	const normalized = p.replace(/[\\/]+$/, "");
	const idx = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
	return idx === -1 ? normalized : normalized.slice(idx + 1);
}
