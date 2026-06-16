import type { UblAttachment } from "@financica/ubl";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { isTauri } from "./tauri";

export type AttachmentKind = "pdf" | "image" | "other";

/** Decode an attachment's base64 payload to raw bytes, or null if it has none. */
export function attachmentBytes(att: UblAttachment): Uint8Array | null {
	if (!att.base64Content) return null;
	try {
		const binary = atob(att.base64Content.replace(/\s/g, ""));
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
		return bytes;
	} catch {
		return null;
	}
}

/** Best-effort MIME type, falling back to the filename extension. */
export function attachmentMime(att: UblAttachment): string {
	if (att.mimeCode) return att.mimeCode;
	const ext = att.filename?.split(".").pop()?.toLowerCase();
	if (ext === "pdf") return "application/pdf";
	if (ext && ["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext)) return `image/${ext}`;
	return "application/octet-stream";
}

export function attachmentKind(att: UblAttachment): AttachmentKind {
	const mime = attachmentMime(att);
	if (mime === "application/pdf") return "pdf";
	if (mime.startsWith("image/")) return "image";
	return "other";
}

/** A sensible download/display filename, even when the UBL omits one. */
export function attachmentName(att: UblAttachment, index: number): string {
	if (att.filename) return att.filename;
	const ext =
		attachmentKind(att) === "pdf" ? "pdf" : attachmentKind(att) === "image" ? "img" : "bin";
	return `attachment-${index + 1}.${ext}`;
}

export function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
	return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Create an object URL for previewing an embedded attachment in an iframe/img.
 * WebView2 (Chromium) renders PDFs and images natively from a blob URL. The
 * caller must `URL.revokeObjectURL` it when done. Returns null if the
 * attachment has no embedded bytes (e.g. an external-URI-only reference).
 */
export function attachmentObjectUrl(att: UblAttachment): string | null {
	const bytes = attachmentBytes(att);
	if (!bytes) return null;
	// Copy into a fresh ArrayBuffer so the Blob owns its memory.
	const blob = new Blob([bytes.slice()], { type: attachmentMime(att) });
	return URL.createObjectURL(blob);
}

/**
 * Save an embedded attachment to disk. On the desktop this opens a native Save
 * dialog and writes via the fs plugin; in a plain browser it falls back to an
 * anchor download. No-op (returns false) when there are no embedded bytes.
 */
export async function saveAttachment(att: UblAttachment, index: number): Promise<boolean> {
	const bytes = attachmentBytes(att);
	if (!bytes) return false;
	const name = attachmentName(att, index);

	if (isTauri()) {
		const path = await saveDialog({ defaultPath: name });
		if (!path) return false;
		await writeFile(path, bytes);
		return true;
	}

	// Browser fallback: anchor download.
	const url = URL.createObjectURL(new Blob([bytes.slice()], { type: attachmentMime(att) }));
	const a = document.createElement("a");
	a.href = url;
	a.download = name;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
	return true;
}
