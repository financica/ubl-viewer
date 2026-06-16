import { describe, expect, it } from "vitest";
import { fixtureBytes } from "../test/fixtures";
import {
	attachmentBytes,
	attachmentKind,
	attachmentMime,
	attachmentName,
	formatBytes,
} from "./attachments";
import { decodeAndParse } from "./decode";

function firstAttachment() {
	const { invoice } = decodeAndParse(fixtureBytes("invoice-with-pdf.xml"));
	const att = invoice?.attachments?.[0];
	if (!att) throw new Error("fixture should contain an embedded attachment");
	return att;
}

describe("attachments", () => {
	it("extracts the embedded PDF and decodes it to bytes", () => {
		const att = firstAttachment();
		const bytes = attachmentBytes(att);
		if (!bytes) throw new Error("embedded PDF should decode to bytes");
		// PDF magic number "%PDF".
		expect(Array.from(bytes.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46]);
	});

	it("classifies the attachment as a PDF", () => {
		const att = firstAttachment();
		expect(attachmentKind(att)).toBe("pdf");
		expect(attachmentMime(att)).toBe("application/pdf");
		expect(attachmentName(att, 0)).toBe("invoice-copy.pdf");
	});

	it("returns null bytes when there is no embedded content", () => {
		expect(attachmentBytes({ id: "x", externalUri: "https://example.com/a.pdf" })).toBeNull();
	});

	it("infers the kind from the filename when mimeCode is absent", () => {
		expect(attachmentKind({ id: "x", filename: "scan.png", base64Content: "AAA=" })).toBe("image");
		expect(attachmentMime({ id: "x", filename: "scan.png", base64Content: "AAA=" })).toBe(
			"image/png",
		);
	});

	it("formats byte sizes", () => {
		expect(formatBytes(512)).toBe("512 B");
		expect(formatBytes(2048)).toBe("2 KB");
		expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
	});
});
