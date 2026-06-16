import { openWithDialog } from "../core/openFile";
import { printInvoice } from "../core/print";
import { actions, activeDoc, useSelector, useStore } from "../core/store";
import { cycleTheme, useTheme } from "../core/theme";

const THEME_LABEL = { system: "Auto", light: "Light", dark: "Dark" } as const;
const THEME_ICON = { system: "🌗", light: "☀️", dark: "🌙" } as const;

/** Top app bar: open, document title, and per-document view controls (§9). */
export function Toolbar() {
	const state = useStore();
	const { pref } = useTheme();
	const doc = activeDoc(state);
	const viewMode = doc ? (state.viewModes[doc.id] ?? "rendered") : "rendered";
	const zoom = useSelector((s) => s.zoom);

	const hasInvoice = !!doc?.invoice;
	const canRaw = typeof doc?.xml === "string" && doc.xml.length > 0;

	return (
		<header className="toolbar">
			<div className="toolbar__group">
				<button
					type="button"
					className="button"
					onClick={() => void openWithDialog()}
					title="Open… (Ctrl+O)"
				>
					<span aria-hidden="true">📂</span> Open
				</button>
			</div>

			<div className="toolbar__title" aria-live="polite">
				{doc ? (
					<DocTitle name={doc.name} type={doc.invoice?.documentType} id={doc.invoice?.id} />
				) : null}
			</div>

			<div className="toolbar__group toolbar__group--end">
				{hasInvoice && (
					<>
						<div className="zoom" role="group" aria-label="Zoom">
							<button
								type="button"
								className="iconbtn"
								onClick={() => actions.zoomOut()}
								aria-label="Zoom out (Ctrl+-)"
							>
								−
							</button>
							<button
								type="button"
								className="zoom__level"
								onClick={() => actions.zoomReset()}
								aria-label="Reset zoom (Ctrl+0)"
								title="Reset zoom"
							>
								{Math.round(zoom * 100)}%
							</button>
							<button
								type="button"
								className="iconbtn"
								onClick={() => actions.zoomIn()}
								aria-label="Zoom in (Ctrl++)"
							>
								+
							</button>
						</div>

						<button
							type="button"
							className="iconbtn"
							onClick={() => actions.openSearch()}
							aria-label="Find (Ctrl+F)"
							title="Find (Ctrl+F)"
						>
							🔍
						</button>

						<button
							type="button"
							className="iconbtn"
							onClick={() => printInvoice()}
							aria-label="Print or export PDF (Ctrl+P)"
							title="Print / export PDF (Ctrl+P)"
						>
							🖨️
						</button>
					</>
				)}

				{canRaw && (
					<button
						type="button"
						className={`button button--toggle ${viewMode === "raw" ? "is-on" : ""}`}
						onClick={() => doc && actions.toggleRaw()}
						aria-pressed={viewMode === "raw"}
						title="Toggle raw XML (Ctrl+R)"
					>
						{"</>"} XML
					</button>
				)}

				<button
					type="button"
					className="iconbtn"
					onClick={() => actions.setTheme(cycleTheme(pref))}
					aria-label={`Theme: ${THEME_LABEL[pref]}`}
					title={`Theme: ${THEME_LABEL[pref]}`}
				>
					{THEME_ICON[pref]}
				</button>
			</div>
		</header>
	);
}

function DocTitle({
	name,
	type,
	id,
}: {
	name: string;
	type?: "Invoice" | "CreditNote";
	id?: string;
}) {
	if (!type) return <span className="toolbar__filename">{name}</span>;
	return (
		<span className="toolbar__doctitle">
			<span className={`doc-badge doc-badge--${type === "CreditNote" ? "cn" : "inv"}`}>
				{type === "CreditNote" ? "Credit note" : "Invoice"}
			</span>
			{id && <span className="toolbar__docid">{id}</span>}
		</span>
	);
}
