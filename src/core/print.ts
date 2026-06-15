import { type UblInvoiceData, renderUblInvoiceHtml } from "@financica/react-ubl-renderer";

/**
 * Print / export-to-PDF (§9). We render the invoice to a self-contained HTML
 * document (styles inlined by the renderer) inside a hidden iframe and print
 * *that*, so the output is clean — no app toolbar, tabs, or theme chrome, just
 * the invoice. The system print dialog's "Save as PDF" handles export.
 *
 * Everything stays local: `renderUblInvoiceHtml` is pure, no network (§11).
 */
export function printInvoice(invoice: UblInvoiceData, locale: string = navigator.language): void {
	const html = renderUblInvoiceHtml(invoice, { locale });

	const frame = document.createElement("iframe");
	frame.setAttribute("aria-hidden", "true");
	frame.style.position = "fixed";
	frame.style.right = "0";
	frame.style.bottom = "0";
	frame.style.width = "0";
	frame.style.height = "0";
	frame.style.border = "0";
	frame.style.visibility = "hidden";

	const cleanup = () => {
		// Defer removal so the print dialog has the document while it's open.
		window.setTimeout(() => frame.remove(), 1000);
	};

	frame.onload = () => {
		const win = frame.contentWindow;
		if (!win) {
			cleanup();
			return;
		}
		win.addEventListener("afterprint", cleanup, { once: true });
		win.focus();
		win.print();
	};

	document.body.appendChild(frame);
	const doc = frame.contentDocument;
	if (!doc) {
		frame.remove();
		return;
	}
	doc.open();
	doc.write(html);
	doc.close();
}
