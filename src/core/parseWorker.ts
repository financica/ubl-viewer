/// <reference lib="webworker" />
import { decodeAndParse } from "./decode";

// Off-main-thread decode + parse for large documents (§10), so the UI never
// janks while a pathologically large invoice is processed. The message payload
// is the raw bytes; the reply is the same `DecodeResult` shape `decodeAndParse`
// returns.
self.onmessage = (event: MessageEvent<{ id: number; bytes: Uint8Array }>) => {
	const { id, bytes } = event.data;
	const result = decodeAndParse(bytes);
	self.postMessage({ id, result });
};
