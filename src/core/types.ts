import type { UblInvoiceData } from "@financica/react-ubl-renderer";

/** Why a document could not be displayed as an invoice. */
export type DocErrorKind =
	| "not-ubl" // valid XML, but not a UBL Invoice/CreditNote
	| "parse-error" // malformed / undecodable XML
	| "read-error" // the file could not be read from disk
	| "empty"; // the file was empty

export interface DocError {
	kind: DocErrorKind;
	/** A human, non-technical sentence describing the problem. */
	message: string;
	/** Optional technical detail for diagnostics (never shown as the headline). */
	detail?: string;
}

/**
 * One open document (a tab). A document always carries its raw XML (when we
 * managed to decode it) so the "View raw XML" escape hatch works even for files
 * that aren't valid invoices.
 */
export interface Doc {
	/** Stable id for React keys and tab routing. */
	id: string;
	/** Absolute path on disk, when opened from a path. Undefined for in-memory drops. */
	path?: string;
	/** Display name (file name, or a synthesized label). */
	name: string;
	/** Decoded XML text, if decoding succeeded. */
	xml?: string;
	/** Parsed invoice, if this is a UBL Invoice/CreditNote. */
	invoice?: UblInvoiceData;
	/** Set when the document can't be rendered as an invoice. */
	error?: DocError;
	/** True while bytes are being decoded/parsed (large-file path). */
	loading?: boolean;
}

export type DocViewMode = "rendered" | "raw";
