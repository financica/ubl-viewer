import { beforeEach, describe, expect, it } from "vitest";
import { __resetStore, actions, activeDoc, clampZoom, getState, nextDocId } from "./store";

function makeDoc(path?: string) {
	return { id: nextDocId(), name: path ?? "untitled", path };
}

describe("store", () => {
	beforeEach(() => __resetStore());

	it("adds a document and makes it active", () => {
		const id = actions.addDoc(makeDoc("/a/inv.xml"));
		expect(activeDoc(getState())?.id).toBe(id);
		expect(getState().docs).toHaveLength(1);
	});

	it("focuses the existing tab instead of duplicating the same path", () => {
		const first = actions.addDoc(makeDoc("/a/inv.xml"));
		const second = actions.addDoc(makeDoc("/a/inv.xml"));
		expect(second).toBe(first);
		expect(getState().docs).toHaveLength(1);
	});

	it("reassigns active to the left neighbour when closing the active tab", () => {
		const a = actions.addDoc(makeDoc("/a.xml"));
		const b = actions.addDoc(makeDoc("/b.xml"));
		actions.addDoc(makeDoc("/c.xml"));
		actions.setActive(b);
		actions.closeDoc(b);
		expect(getState().activeId).toBe(a);
		expect(getState().docs).toHaveLength(2);
	});

	it("toggles raw view per document", () => {
		const id = actions.addDoc(makeDoc("/a.xml"));
		expect(getState().viewModes[id]).toBe("rendered");
		actions.toggleRaw();
		expect(getState().viewModes[id]).toBe("raw");
		actions.toggleRaw();
		expect(getState().viewModes[id]).toBe("rendered");
	});

	it("clamps zoom within bounds", () => {
		expect(clampZoom(0.1)).toBe(0.5);
		expect(clampZoom(9)).toBe(2.5);
		expect(clampZoom(1.234)).toBe(1.23);
	});

	it("cycles tabs with wraparound", () => {
		const a = actions.addDoc(makeDoc("/a.xml"));
		actions.addDoc(makeDoc("/b.xml"));
		actions.setActive(a);
		actions.cycleTab(-1); // wrap to last
		expect(getState().activeId).not.toBe(a);
		actions.cycleTab(1); // back to first
		expect(getState().activeId).toBe(a);
	});

	it("remembers recent files, de-duplicating by path", () => {
		actions.rememberRecent({ path: "/a.xml", name: "a.xml", openedAt: 1 });
		actions.rememberRecent({ path: "/b.xml", name: "b.xml", openedAt: 2 });
		actions.rememberRecent({ path: "/a.xml", name: "a.xml", openedAt: 3 });
		const recent = getState().recent;
		expect(recent).toHaveLength(2);
		expect(recent[0].path).toBe("/a.xml"); // most-recent first
	});
});
