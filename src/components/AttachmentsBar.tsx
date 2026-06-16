import type { UblAttachment } from "@financica/ubl";
import { useEffect, useState } from "react";
import {
	attachmentBytes,
	attachmentKind,
	attachmentMime,
	attachmentName,
	formatBytes,
	saveAttachment,
} from "../core/attachments";

const KIND_ICON = { pdf: "📕", image: "🖼️", other: "📎" } as const;

/**
 * Shows documents embedded in the UBL invoice (UBL
 * `AdditionalDocumentReference` → `EmbeddedDocumentBinaryObject`), which the
 * renderer itself does not display. PDFs and images can be previewed inline
 * (WebView2 renders them natively); anything can be saved to disk.
 */
export function AttachmentsBar({ attachments }: { attachments: UblAttachment[] }) {
	const [preview, setPreview] = useState<{ att: UblAttachment; index: number } | null>(null);

	const embedded = attachments
		.map((att, index) => ({ att, index }))
		.filter(({ att }) => att.base64Content || att.externalUri);

	if (embedded.length === 0) return null;

	return (
		<div className="attachments">
			<span className="attachments__label">
				<span aria-hidden="true">📎</span>
				{embedded.length} attached {embedded.length === 1 ? "document" : "documents"}
			</span>
			{embedded.map(({ att, index }) => (
				<AttachmentChip
					key={att.id ?? index}
					att={att}
					index={index}
					onPreview={() => setPreview({ att, index })}
				/>
			))}
			{preview && (
				<AttachmentPreview
					att={preview.att}
					index={preview.index}
					onClose={() => setPreview(null)}
				/>
			)}
		</div>
	);
}

function AttachmentChip({
	att,
	index,
	onPreview,
}: {
	att: UblAttachment;
	index: number;
	onPreview: () => void;
}) {
	const kind = attachmentKind(att);
	const name = attachmentName(att, index);
	const bytes = attachmentBytes(att);
	const canPreview = !!bytes && (kind === "pdf" || kind === "image");

	return (
		<span className="attachment">
			<span className="attachment__icon" aria-hidden="true">
				{KIND_ICON[kind]}
			</span>
			<span className="attachment__name" title={name}>
				{name}
			</span>
			{bytes && <span className="attachment__size">{formatBytes(bytes.length)}</span>}
			{canPreview && (
				<button type="button" className="attachment__btn" onClick={onPreview}>
					View
				</button>
			)}
			{bytes && (
				<button
					type="button"
					className="attachment__btn"
					onClick={() => void saveAttachment(att, index)}
				>
					Save
				</button>
			)}
			{!bytes && att.externalUri && (
				<span className="attachment__size" title={att.externalUri}>
					external link
				</span>
			)}
		</span>
	);
}

/** Full-window preview of an embedded PDF or image. */
function AttachmentPreview({
	att,
	index,
	onClose,
}: {
	att: UblAttachment;
	index: number;
	onClose: () => void;
}) {
	const [url, setUrl] = useState<string | null>(null);
	const kind = attachmentKind(att);
	const name = attachmentName(att, index);

	useEffect(() => {
		const bytes = attachmentBytes(att);
		if (!bytes) return;
		const objectUrl = URL.createObjectURL(new Blob([bytes.slice()], { type: attachmentMime(att) }));
		setUrl(objectUrl);
		return () => URL.revokeObjectURL(objectUrl);
	}, [att]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	return (
		<div className="preview-overlay" role="dialog" aria-modal="true" aria-label={`Preview ${name}`}>
			<div className="preview-overlay__bar">
				<span className="preview-overlay__title">{name}</span>
				<button type="button" className="button" onClick={() => void saveAttachment(att, index)}>
					Save…
				</button>
				<button type="button" className="iconbtn" aria-label="Close preview" onClick={onClose}>
					✕
				</button>
			</div>
			{url &&
				(kind === "image" ? (
					<img className="preview-overlay__image" src={url} alt={name} />
				) : (
					<iframe className="preview-overlay__frame" src={url} title={name} />
				))}
		</div>
	);
}
