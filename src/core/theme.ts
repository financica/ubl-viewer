import { useEffect } from "react";
import { type ThemePref, useSelector } from "./store";

/** Resolve a preference to the concrete theme to apply right now. */
export function resolveTheme(pref: ThemePref): "light" | "dark" {
	if (pref !== "system") return pref;
	if (typeof window === "undefined" || !window.matchMedia) return "light";
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Applies the chosen theme to the document root and keeps it in sync with the
 * OS when the preference is "system" (§9: follow the OS, with manual override).
 */
export function useTheme(): { pref: ThemePref; resolved: "light" | "dark" } {
	const pref = useSelector((s) => s.theme);
	const resolved = resolveTheme(pref);

	useEffect(() => {
		document.documentElement.dataset.theme = resolved;
	}, [resolved]);

	useEffect(() => {
		if (pref !== "system" || typeof window === "undefined" || !window.matchMedia) return;
		const mql = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => {
			document.documentElement.dataset.theme = mql.matches ? "dark" : "light";
		};
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, [pref]);

	return { pref, resolved };
}

export function cycleTheme(pref: ThemePref): ThemePref {
	const order: ThemePref[] = ["system", "light", "dark"];
	const idx = order.indexOf(pref);
	return order[(idx + 1) % order.length];
}
