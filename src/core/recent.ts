/**
 * Recent-files list, persisted to localStorage. Stores only paths + labels —
 * never document contents (§11: confidential financial data stays on the
 * document path, not in app storage).
 */
export interface RecentFile {
	path: string;
	name: string;
	/** Epoch ms of last open; used for ordering and pruning. */
	openedAt: number;
}

const STORAGE_KEY = "ubl-viewer.recent";
const MAX_RECENT = 12;

export function loadRecent(): RecentFile[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((r): r is RecentFile => typeof r?.path === "string" && typeof r?.name === "string")
			.slice(0, MAX_RECENT);
	} catch {
		return [];
	}
}

export function saveRecent(list: RecentFile[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
	} catch {
		// Storage may be unavailable (private mode, quota) — recents are a
		// convenience, never essential.
	}
}

/** Returns a new list with `entry` moved/added to the front, de-duplicated by path. */
export function pushRecent(list: RecentFile[], entry: RecentFile): RecentFile[] {
	const deduped = list.filter((r) => r.path !== entry.path);
	return [entry, ...deduped].slice(0, MAX_RECENT);
}
