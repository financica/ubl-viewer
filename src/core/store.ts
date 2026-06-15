import { useSyncExternalStore } from "react";
import { type RecentFile, loadRecent, pushRecent, saveRecent } from "./recent";
import type { Doc, DocViewMode } from "./types";

export type ThemePref = "system" | "light" | "dark";

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2.5;
export const ZOOM_STEP = 0.1;

const THEME_KEY = "ubl-viewer.theme";

export interface AppState {
	docs: Doc[];
	activeId: string | null;
	/** Per-document view mode (rendered invoice vs. raw XML). */
	viewModes: Record<string, DocViewMode>;
	/** Global zoom factor applied to the rendered invoice. */
	zoom: number;
	theme: ThemePref;
	recent: RecentFile[];
	search: { open: boolean; query: string; count: number };
	/** True while files are being dragged over the window (drop overlay). */
	dragging: boolean;
}

function initialTheme(): ThemePref {
	try {
		const v = localStorage.getItem(THEME_KEY);
		if (v === "light" || v === "dark" || v === "system") return v;
	} catch {
		// ignore
	}
	return "system";
}

let state: AppState = {
	docs: [],
	activeId: null,
	viewModes: {},
	zoom: 1,
	theme: initialTheme(),
	recent: loadRecent(),
	search: { open: false, query: "", count: 0 },
	dragging: false,
};

const listeners = new Set<() => void>();

function emit() {
	for (const l of listeners) l();
}

function set(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
	const next = typeof patch === "function" ? patch(state) : patch;
	// An empty patch means "no change" (e.g. a guarded no-op action); skip the
	// re-render it would otherwise trigger for whole-store subscribers.
	if (Object.keys(next).length === 0) return;
	state = { ...state, ...next };
	emit();
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function getSnapshot(): AppState {
	return state;
}

/** Synchronous read of the current state (for non-React callers and tests). */
export function getState(): AppState {
	return state;
}

/** Read the whole store reactively. */
export function useStore(): AppState {
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Read a derived slice reactively (re-renders only when the slice changes). */
export function useSelector<T>(selector: (s: AppState) => T): T {
	return useSyncExternalStore(
		subscribe,
		() => selector(state),
		() => selector(state),
	);
}

let docCounter = 0;
export function nextDocId(): string {
	docCounter += 1;
	return `doc-${docCounter}`;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const actions = {
	/** Adds a document and makes it active. If `path` is already open, focuses it. */
	addDoc(doc: Doc): string {
		if (doc.path) {
			const existing = state.docs.find((d) => d.path === doc.path);
			if (existing) {
				// Replace contents (file may have changed) and focus.
				set((s) => ({
					docs: s.docs.map((d) => (d.id === existing.id ? { ...doc, id: existing.id } : d)),
					activeId: existing.id,
					search: { open: false, query: "", count: 0 },
				}));
				return existing.id;
			}
		}
		set((s) => ({
			docs: [...s.docs, doc],
			activeId: doc.id,
			viewModes: { ...s.viewModes, [doc.id]: "rendered" },
			search: { open: false, query: "", count: 0 },
		}));
		return doc.id;
	},

	updateDoc(id: string, patch: Partial<Doc>) {
		set((s) => ({
			docs: s.docs.map((d) => (d.id === id ? { ...d, ...patch } : d)),
		}));
	},

	closeDoc(id: string) {
		set((s) => {
			const idx = s.docs.findIndex((d) => d.id === id);
			if (idx === -1) return {};
			const docs = s.docs.filter((d) => d.id !== id);
			const { [id]: _dropped, ...viewModes } = s.viewModes;
			let activeId = s.activeId;
			if (activeId === id) {
				// Focus the neighbour to the left, else the new first tab.
				activeId = docs[idx - 1]?.id ?? docs[0]?.id ?? null;
			}
			return { docs, viewModes, activeId, search: { open: false, query: "", count: 0 } };
		});
	},

	setActive(id: string) {
		set({ activeId: id, search: { open: false, query: "", count: 0 } });
	},

	/** Focuses the next/previous tab (wraps around). */
	cycleTab(delta: 1 | -1) {
		const { docs, activeId } = state;
		if (docs.length === 0) return;
		const idx = docs.findIndex((d) => d.id === activeId);
		const next = docs[(idx + delta + docs.length) % docs.length];
		if (next) actions.setActive(next.id);
	},

	setViewMode(id: string, mode: DocViewMode) {
		set((s) => ({ viewModes: { ...s.viewModes, [id]: mode } }));
	},

	toggleRaw() {
		const id = state.activeId;
		if (!id) return;
		const current = state.viewModes[id] ?? "rendered";
		actions.setViewMode(id, current === "rendered" ? "raw" : "rendered");
	},

	setZoom(zoom: number) {
		set({ zoom: clampZoom(zoom) });
	},
	zoomIn() {
		actions.setZoom(state.zoom + ZOOM_STEP);
	},
	zoomOut() {
		actions.setZoom(state.zoom - ZOOM_STEP);
	},
	zoomReset() {
		actions.setZoom(1);
	},

	setTheme(theme: ThemePref) {
		try {
			localStorage.setItem(THEME_KEY, theme);
		} catch {
			// ignore
		}
		set({ theme });
	},

	openSearch() {
		set((s) => ({ search: { ...s.search, open: true } }));
	},
	closeSearch() {
		set({ search: { open: false, query: "", count: 0 } });
	},
	setSearchQuery(query: string) {
		set((s) => ({ search: { ...s.search, query } }));
	},
	setSearchCount(count: number) {
		set((s) => (s.search.count === count ? {} : { search: { ...s.search, count } }));
	},

	rememberRecent(entry: RecentFile) {
		set((s) => {
			const recent = pushRecent(s.recent, entry);
			saveRecent(recent);
			return { recent };
		});
	},
	clearRecent() {
		saveRecent([]);
		set({ recent: [] });
	},

	setDragging(dragging: boolean) {
		set((s) => (s.dragging === dragging ? {} : { dragging }));
	},
};

export function clampZoom(zoom: number): number {
	return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(zoom * 100) / 100));
}

/** Selectors */
export function activeDoc(s: AppState): Doc | null {
	return s.docs.find((d) => d.id === s.activeId) ?? null;
}

/** Test-only: reset the module store to a clean slate. */
export function __resetStore() {
	state = {
		docs: [],
		activeId: null,
		viewModes: {},
		zoom: 1,
		theme: "system",
		recent: [],
		search: { open: false, query: "", count: 0 },
		dragging: false,
	};
	docCounter = 0;
	emit();
}
