import { openPath, openWithDialog } from "../core/openFile";
import { actions, useSelector } from "../core/store";

/**
 * The welcome / drop-target screen shown when no document is open. Doubles as a
 * recent-files launcher.
 */
export function EmptyState() {
	const recent = useSelector((s) => s.recent);

	return (
		<div className="state state--welcome">
			<div className="state__icon state__icon--brand" aria-hidden="true">
				🧾
			</div>
			<h1 className="state__title">UBL Viewer</h1>
			<p className="state__message">
				Open a UBL e-invoice or credit note. Drag a file here, or choose one to begin.
			</p>
			<div className="state__actions">
				<button
					type="button"
					className="button button--primary"
					onClick={() => void openWithDialog()}
				>
					Open file…
				</button>
			</div>

			{recent.length > 0 && (
				<div className="recent">
					<div className="recent__header">
						<span>Recent</span>
						<button type="button" className="link" onClick={() => actions.clearRecent()}>
							Clear
						</button>
					</div>
					<ul className="recent__list">
						{recent.map((r) => (
							<li key={r.path}>
								<button
									type="button"
									className="recent__item"
									title={r.path}
									onClick={() => void openPath(r.path)}
								>
									<span className="recent__name">{r.name}</span>
									<span className="recent__path">{r.path}</span>
								</button>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
