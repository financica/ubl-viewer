import { useEffect, useRef } from "react";
import { actions, useSelector } from "../core/store";

/** Floating find-in-document bar (§9). Highlighting is done by InvoiceView. */
export function SearchBar() {
	const search = useSelector((s) => s.search);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (search.open) inputRef.current?.focus();
	}, [search.open]);

	if (!search.open) return null;

	const hasQuery = search.query.length > 0;

	return (
		<div className="searchbar" role="search">
			<span className="searchbar__icon" aria-hidden="true">
				🔍
			</span>
			<input
				ref={inputRef}
				type="search"
				className="searchbar__input"
				placeholder="Find in document"
				aria-label="Find in document"
				value={search.query}
				onChange={(e) => actions.setSearchQuery(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Escape") actions.closeSearch();
				}}
			/>
			<span className="searchbar__count" aria-live="polite">
				{hasQuery ? `${search.count} ${search.count === 1 ? "match" : "matches"}` : ""}
			</span>
			<button
				type="button"
				className="searchbar__close"
				aria-label="Close find"
				onClick={() => actions.closeSearch()}
			>
				✕
			</button>
		</div>
	);
}
