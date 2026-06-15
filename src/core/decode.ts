import { type UblInvoiceData, parseUblInvoice } from "@financica/react-ubl-renderer";
import { sniffUblRoot } from "./sniff";
import type { DocError } from "./types";

/**
 * Decode raw XML bytes into a string, honoring the byte-order mark and the XML
 * encoding declaration.
 *
 * Why not just use `decodeXmlBytes` from `@financica/ubl`? That helper decodes
 * as UTF-8 and only strips a UTF-8 BOM — it mangles UTF-16 files (common for
 * invoices exported by Windows tooling) and anything declaring a non-UTF-8
 * charset. UBL files in the wild are UTF-8, UTF-16, or declare some other
 * encoding (§5); trusting UTF-8 corrupts non-ASCII party names. So we detect
 * the real encoding here before handing a clean string to the parser.
 */
export function decodeXmlBytes(bytes: Uint8Array): string {
	const encoding = detectEncoding(bytes);
	const decoder = new TextDecoder(encoding.label, { fatal: false });
	const text = decoder.decode(bytes);
	// TextDecoder strips a leading BOM for utf-8/utf-16; guard the rare case it
	// doesn't (e.g. a stray U+FEFF mid-stream is left intact, which is correct).
	return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

interface DetectedEncoding {
	/** A label accepted by `TextDecoder`. */
	label: string;
}

function detectEncoding(bytes: Uint8Array): DetectedEncoding {
	// 1. Byte-order marks are authoritative.
	if (bytes.length >= 2) {
		if (bytes[0] === 0xff && bytes[1] === 0xfe) return { label: "utf-16le" };
		if (bytes[0] === 0xfe && bytes[1] === 0xff) return { label: "utf-16be" };
	}
	if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
		return { label: "utf-8" };
	}

	// 2. No BOM: a UTF-16 file without a BOM still has a tell-tale pattern — every
	//    other byte of the ASCII `<?xml`/`<` prolog is NUL.
	if (bytes.length >= 2) {
		if (bytes[0] !== 0x00 && bytes[1] === 0x00) return { label: "utf-16le" };
		if (bytes[0] === 0x00 && bytes[1] !== 0x00) return { label: "utf-16be" };
	}

	// 3. Otherwise read the encoding declaration from the ASCII-decodable prolog.
	const declared = readDeclaredEncoding(bytes);
	if (declared) return { label: declared };

	// 4. Default for XML without a declaration is UTF-8.
	return { label: "utf-8" };
}

/** Reads `encoding="..."` from the `<?xml ?>` declaration, if present. */
function readDeclaredEncoding(bytes: Uint8Array): string | null {
	// The declaration, if any, is pure ASCII at the very start.
	const prolog = new TextDecoder("ascii", { fatal: false }).decode(bytes.subarray(0, 200));
	const match = prolog.match(/<\?xml[^>]*\bencoding\s*=\s*["']([^"']+)["']/i);
	if (!match) return null;
	const label = match[1].toLowerCase();
	// Only return labels TextDecoder is sure to accept; let everything else fall
	// back to UTF-8 rather than throwing on an exotic charset.
	try {
		// Probe that TextDecoder accepts this label; ignore the instance.
		new TextDecoder(label);
		return label;
	} catch {
		return null;
	}
}

export interface DecodeResult {
	xml?: string;
	invoice?: UblInvoiceData;
	error?: DocError;
}

/**
 * The single bytes → string → parsed-invoice path used by every entry point.
 * Never throws: failures come back as a typed `DocError` so the UI can show a
 * clear message with a "View raw XML" escape hatch (§9).
 */
export function decodeAndParse(bytes: Uint8Array): DecodeResult {
	if (bytes.length === 0) {
		return {
			error: {
				kind: "empty",
				message: "This file is empty — there's nothing to display.",
			},
		};
	}

	let xml: string;
	try {
		xml = decodeXmlBytes(bytes);
	} catch (err) {
		return {
			error: {
				kind: "parse-error",
				message: "This file couldn't be read as text. It may be binary or corrupted.",
				detail: errorDetail(err),
			},
		};
	}

	// Authoritative check: the parser decides. The cheap sniff only shapes the
	// error message when the parser declines.
	let invoice: UblInvoiceData | null = null;
	try {
		invoice = parseUblInvoice(xml);
	} catch (err) {
		return {
			xml,
			error: {
				kind: "parse-error",
				message: "This looks like a UBL invoice, but the XML couldn't be parsed.",
				detail: errorDetail(err),
			},
		};
	}

	if (invoice) return { xml, invoice };

	// Not a UBL invoice/credit note. Distinguish "UBL-shaped but rejected" from
	// "not a UBL file at all" for a more useful message.
	const looksUbl = sniffUblRoot(xml) !== null;
	return {
		xml,
		error: {
			kind: "not-ubl",
			message: looksUbl
				? "This is a UBL document, but not an invoice or credit note this app can display."
				: "This XML file isn't a UBL invoice or credit note.",
		},
	};
}

function errorDetail(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}
