import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FIXTURE_DIR = resolve(__dirname, "../../fixtures");

export const FIXTURES = [
	"invoice-basic.xml",
	"credit-note.xml",
	"invoice-utf16.xml",
	"not-ubl.xml",
	"empty.xml",
] as const;

export type FixtureName = (typeof FIXTURES)[number];

/** Read a fixture as raw bytes (mirrors what `readFile` returns at runtime). */
export function fixtureBytes(name: FixtureName): Uint8Array {
	return new Uint8Array(readFileSync(resolve(FIXTURE_DIR, name)));
}

/** Read a fixture as UTF-8 text (only valid for the UTF-8 fixtures). */
export function fixtureText(name: FixtureName): string {
	return readFileSync(resolve(FIXTURE_DIR, name), "utf8");
}
