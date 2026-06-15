import { describe, expect, it } from "vitest";
import { fixtureText } from "../test/fixtures";
import { sniffUblRoot } from "./sniff";

describe("sniffUblRoot", () => {
	it("recognizes a UBL invoice root", () => {
		expect(sniffUblRoot(fixtureText("invoice-basic.xml"))).toBe("Invoice");
	});

	it("recognizes a UBL credit note root", () => {
		expect(sniffUblRoot(fixtureText("credit-note.xml"))).toBe("CreditNote");
	});

	it("returns null for non-UBL XML", () => {
		expect(sniffUblRoot(fixtureText("not-ubl.xml"))).toBeNull();
	});

	it("sees through an SBDH envelope wrapper", () => {
		const wrapped = `<?xml version="1.0"?>
<StandardBusinessDocument xmlns="http://www.unece.org/cefact/namespaces/StandardBusinessDocumentHeader">
  <StandardBusinessDocumentHeader/>
  <Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"/>
</StandardBusinessDocument>`;
		expect(sniffUblRoot(wrapped)).toBe("Invoice");
	});
});
