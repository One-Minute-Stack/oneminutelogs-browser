/** Lifecycle hints flush existing diagnostics only. They never create telemetry. */
export declare function attachTransportLifecycle(doc: Document, win: Window, flush: () => void): () => void;
