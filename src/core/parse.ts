import { type DecodeResult, decodeAndParse } from "./decode";

/**
 * Files larger than this are decoded + parsed in a Web Worker so the UI thread
 * never blocks (§10). Normal invoices are a few KB and take the fast inline
 * path, so the worker spin-up cost is only paid where it actually helps.
 */
const WORKER_THRESHOLD_BYTES = 512 * 1024;

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (result: DecodeResult) => void>();

function getWorker(): Worker | null {
	if (typeof Worker === "undefined") return null;
	if (worker) return worker;
	try {
		worker = new Worker(new URL("./parseWorker.ts", import.meta.url), { type: "module" });
		worker.onmessage = (event: MessageEvent<{ id: number; result: DecodeResult }>) => {
			const resolve = pending.get(event.data.id);
			if (resolve) {
				pending.delete(event.data.id);
				resolve(event.data.result);
			}
		};
		worker.onerror = () => {
			// If the worker dies, fail open: future calls fall back to inline parsing.
			worker = null;
		};
		return worker;
	} catch {
		worker = null;
		return null;
	}
}

/**
 * Decode + parse bytes, transparently using a worker for large files and the
 * inline path for everything else. Always resolves (errors are encoded in the
 * returned `DecodeResult`).
 */
export function decodeAndParseAsync(bytes: Uint8Array): Promise<DecodeResult> {
	if (bytes.length < WORKER_THRESHOLD_BYTES) {
		return Promise.resolve(decodeAndParse(bytes));
	}
	const w = getWorker();
	if (!w) return Promise.resolve(decodeAndParse(bytes));

	const id = ++seq;
	return new Promise<DecodeResult>((resolve) => {
		pending.set(id, resolve);
		// Copy the buffer for transfer so the caller keeps its view intact.
		w.postMessage({ id, bytes });
	});
}

/** True when a file of this size will take the worker path. */
export function willUseWorker(byteLength: number): boolean {
	return byteLength >= WORKER_THRESHOLD_BYTES && typeof Worker !== "undefined";
}
