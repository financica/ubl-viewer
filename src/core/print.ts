/**
 * Print / export-to-PDF (§9).
 *
 * We print the live page with `window.print()` and rely on the `@media print`
 * stylesheet (src/styles/app.css) to strip the app chrome and show only the
 * invoice — clean output, and crucially a SINGLE dialog. The earlier hidden-
 * iframe approach fought WebView2's built-in Ctrl+P, which fired its own print
 * too, producing two dialogs. The system print dialog's "Save as PDF" handles
 * export. Everything stays local (§11).
 */
export function printInvoice(): void {
	window.print();
}
