import type { TransportSnapshot } from "./types.js";
type Controls = {
    flush(): void;
    getSnapshot(): TransportSnapshot;
};
export declare function publishTransport(snapshot: TransportSnapshot): void;
export declare function attachTransportDebug(controls: Controls): () => void;
/** Temporary diagnostic API, never required by application integrations. */
export declare function subscribeTransport(listener: (snapshot: TransportSnapshot) => void): () => void;
export declare function flushTransport(): void;
export {};
