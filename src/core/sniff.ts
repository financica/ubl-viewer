/**
 * Cheap, dependency-free pre-check: does this XML look like a UBL Invoice or
 * CreditNote? This is a fast gate before the authoritative `parseUblInvoice`,
 * and it powers clearer error messages (a generic `.xml` that isn't UBL at all
 * vs. a UBL document the parser still rejected).
 *
 * We do NOT treat a positive result as proof — `parseUblInvoice` returning
 * non-null is the authority (§6c). We only use this to:
 *   - skip the parser entirely for obviously-non-UBL files, and
 *   - distinguish "not a UBL file" from "UBL-shaped but unparseable".
 */
const UBL_INVOICE_NS = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
const UBL_CREDIT_NOTE_NS = "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2";

export type RootGuess = "Invoice" | "CreditNote" | null;

/**
 * Inspect the document root element without a full DOM parse. Returns the UBL
 * document kind when the root is `<Invoice>`/`<CreditNote>` in the UBL
 * namespace (directly, or wrapped in an SBDH envelope), otherwise null.
 */
export function sniffUblRoot(xml: string): RootGuess {
	// Look at a generous prefix only — namespaces are declared on the root.
	const head = xml.slice(0, 4096);

	const hasInvoiceNs = head.includes(UBL_INVOICE_NS);
	const hasCreditNs = head.includes(UBL_CREDIT_NOTE_NS);

	// Find the first real element name (skip prolog, comments, and any SBDH
	// StandardBusinessDocument wrapper that Peppol AS4 delivery adds).
	const localRoot = firstMeaningfulElement(head);

	if (localRoot === "Invoice" || (hasInvoiceNs && !hasCreditNs)) return "Invoice";
	if (localRoot === "CreditNote" || (hasCreditNs && !hasInvoiceNs)) return "CreditNote";

	// Namespace present but ambiguous root → fall back to whichever ns we saw.
	if (hasInvoiceNs) return "Invoice";
	if (hasCreditNs) return "CreditNote";
	return null;
}

/** Local name of the first element that isn't an SBDH wrapper. */
function firstMeaningfulElement(head: string): string | null {
	const wrappers = new Set(["StandardBusinessDocument", "StandardBusinessDocumentHeader"]);
	const tagRe = /<([A-Za-z_][\w.-]*)(?::([A-Za-z_][\w.-]*))?[\s/>]/g;
	let match: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex loop
	while ((match = tagRe.exec(head)) !== null) {
		// match[2] is the local name when a prefix is present, else match[1].
		const local = match[2] ?? match[1];
		if (!wrappers.has(local)) return local;
	}
	return null;
}
