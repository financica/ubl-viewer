import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decodeAndParse } from "../core/decode";
import { __resetStore, actions, getState, nextDocId } from "../core/store";
import type { Doc } from "../core/types";
import { fixtureBytes } from "../test/fixtures";
import { DocumentView } from "./DocumentView";
import { InvoiceView } from "./InvoiceView";

function parse(name: Parameters<typeof fixtureBytes>[0]) {
	return decodeAndParse(fixtureBytes(name));
}

function parseInvoice(name: Parameters<typeof fixtureBytes>[0]) {
	const { invoice } = parse(name);
	if (!invoice) throw new Error(`fixture ${name} should parse as an invoice`);
	return invoice;
}

afterEach(cleanup);
beforeEach(() => __resetStore());

describe("InvoiceView", () => {
	it("renders the invoice's key fields", () => {
		const invoice = parseInvoice("invoice-basic.xml");
		render(<InvoiceView invoice={invoice} />);
		// The id and seller name legitimately appear more than once (e.g. payment
		// reference, payee account), so assert "at least one".
		expect(screen.getAllByText(/INV-2024-0042/).length).toBeGreaterThan(0);
		expect(screen.getAllByText(/Café Søyland AS/).length).toBeGreaterThan(0);
		expect(screen.getByText(/Nordlys Konsult AS/)).toBeInTheDocument();
		// Both invoice lines render.
		expect(screen.getByText(/Espresso blend/)).toBeInTheDocument();
	});

	it("renders a credit note", () => {
		const invoice = parseInvoice("credit-note.xml");
		expect(invoice.documentType).toBe("CreditNote");
		render(<InvoiceView invoice={invoice} />);
		expect(screen.getByText(/CN-2024-0007/)).toBeInTheDocument();
	});
});

describe("DocumentView", () => {
	it("shows an error state with a raw-XML escape hatch for non-UBL files", () => {
		const result = parse("not-ubl.xml");
		const doc: Doc = { id: nextDocId(), name: "not-ubl.xml", xml: result.xml, error: result.error };
		actions.addDoc(doc);

		render(<DocumentView doc={doc} />);
		expect(screen.getByRole("alert")).toHaveTextContent(/not a UBL/i);

		fireEvent.click(screen.getByRole("button", { name: /view raw xml/i }));
		expect(getState().viewModes[doc.id]).toBe("raw");
	});

	it("renders raw XML when in raw view mode", () => {
		const result = parse("invoice-basic.xml");
		const doc: Doc = {
			id: nextDocId(),
			name: "invoice-basic.xml",
			xml: result.xml,
			invoice: result.invoice,
		};
		actions.addDoc(doc);
		actions.setViewMode(doc.id, "raw");

		render(<DocumentView doc={doc} />);
		expect(screen.getByLabelText(/raw xml source/i)).toBeInTheDocument();
	});
});
