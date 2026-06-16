import { useMemo, useState } from "react";

/**
 * Read-only raw-XML view with lightweight, dependency-free syntax highlighting
 * (§9). We escape the text first, then colourise tags/attributes/values with
 * regex over the *escaped* string — so no raw document text ever reaches the DOM
 * as markup (§11).
 */
export function RawXmlView({ xml }: { xml: string }) {
	const html = useMemo(() => highlightXml(xml), [xml]);

	return (
		<div className="raw-xml-wrap">
			<div className="raw-xml-toolbar">
				<CopyButton text={xml} />
			</div>
			{/* `html` is built only from HTML-escaped text plus our own <span> tags. */}
			<pre className="raw-xml" aria-label="Raw XML source">
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: content is escaped in highlightXml */}
				<code dangerouslySetInnerHTML={{ __html: html }} />
			</pre>
		</div>
	);
}

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1500);
		} catch {
			// Clipboard can be blocked; fail quietly rather than throwing.
		}
	}

	return (
		<button type="button" className="button" onClick={copy} aria-live="polite">
			{copied ? "✓ Copied" : "Copy XML"}
		</button>
	);
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/**
 * Tokenise escaped XML into coloured spans. Operates entirely on already-escaped
 * text (`&lt;tag&gt;`), so the only literal `<`/`>` introduced are our spans'.
 */
function highlightXml(xml: string): string {
	const escaped = escapeHtml(xml);

	return (
		escaped
			// Comments
			.replace(/&lt;!--[\s\S]*?--&gt;/g, (m) => `<span class="x-comment">${m}</span>`)
			// Tags: &lt;/prefix:name ...attrs... /&gt;
			.replace(/(&lt;\/?)([\w.:-]+)([\s\S]*?)(\/?&gt;)/g, (_m, open, name, attrs, close) => {
				const colouredAttrs = attrs.replace(
					/([\w.:-]+)(=)(&quot;[\s\S]*?&quot;)/g,
					(_a: string, an: string, eq: string, av: string) =>
						`<span class="x-attr">${an}</span>${eq}<span class="x-value">${av}</span>`,
				);
				return `<span class="x-punct">${open}</span><span class="x-tag">${name}</span>${colouredAttrs}<span class="x-punct">${close}</span>`;
			})
	);
}
