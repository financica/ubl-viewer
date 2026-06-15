import { describe, expect, it } from "vitest";
import { fixtureBytes } from "../test/fixtures";
import { decodeAndParse, decodeXmlBytes } from "./decode";

describe("decodeXmlBytes", () => {
	it("decodes UTF-8 and strips a BOM", () => {
		const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("<x/>")]);
		expect(decodeXmlBytes(bytes)).toBe("<x/>");
	});

	it("decodes UTF-16LE with a BOM without mangling non-ASCII text", () => {
		// The library's own decoder is UTF-8-only; ours must handle this.
		const xml = decodeXmlBytes(fixtureBytes("invoice-utf16.xml"));
		expect(xml).toContain("Café Søyland AS");
		expect(xml).toContain("<cbc:ID>INV-2024-0042</cbc:ID>");
	});

	it("honors the encoding declaration when there is no BOM", () => {
		const latin1 = new Uint8Array([
			...new TextEncoder().encode('<?xml version="1.0" encoding="ISO-8859-1"?><n>'),
			0xe9, // é in latin-1
			...new TextEncoder().encode("</n>"),
		]);
		expect(decodeXmlBytes(latin1)).toContain("é");
	});
});

describe("decodeAndParse", () => {
	it("parses a UBL invoice", () => {
		const { invoice, error } = decodeAndParse(fixtureBytes("invoice-basic.xml"));
		expect(error).toBeUndefined();
		expect(invoice?.documentType).toBe("Invoice");
		expect(invoice?.id).toBe("INV-2024-0042");
		expect(invoice?.monetaryTotal.payableAmount).toBe(625);
		expect(invoice?.lines).toHaveLength(2);
		expect(invoice?.seller.name).toBe("Café Søyland AS");
	});

	it("parses a UBL credit note and labels its documentType", () => {
		const { invoice } = decodeAndParse(fixtureBytes("credit-note.xml"));
		expect(invoice?.documentType).toBe("CreditNote");
		expect(invoice?.id).toBe("CN-2024-0007");
	});

	it("preserves non-ASCII party names from a UTF-16 file", () => {
		const { invoice } = decodeAndParse(fixtureBytes("invoice-utf16.xml"));
		expect(invoice?.documentType).toBe("Invoice");
		expect(invoice?.seller.name).toBe("Café Søyland AS");
	});

	it("reports valid-but-non-UBL XML as not-ubl, keeping the raw text", () => {
		const result = decodeAndParse(fixtureBytes("not-ubl.xml"));
		expect(result.invoice).toBeUndefined();
		expect(result.error?.kind).toBe("not-ubl");
		expect(result.xml).toContain("<note>");
	});

	it("reports an empty file as empty", () => {
		const result = decodeAndParse(fixtureBytes("empty.xml"));
		expect(result.error?.kind).toBe("empty");
	});
});
