import type { RumEvent } from "./events.js";
import type { Sender, TransportSnapshot } from "./types.js";
export interface CollectorOptions {
    send: Sender;
    now?: () => number;
    id?: () => string;
    random?: () => number;
    maxEvents?: number;
    maxBytes?: number;
    batchBytes?: number;
}
/** Per-runtime collector. Events are never coalesced or mutated; sealed bodies are immutable. */
export declare function createCollector(options: CollectorOptions): {
    enqueue: (input: RumEvent) => {
        accepted: boolean;
        reason?: string;
    };
    flush: (keepalive?: boolean) => void;
    getSnapshot: () => TransportSnapshot;
    tick(): void;
    subscribe(listener: (value: TransportSnapshot) => void): () => void;
    dispose(): void;
};
