export type { PageContext } from "../views/types.js";
export { subscribeTransport, flushTransport } from "../transport/debug.js";
export type { TransportSnapshot } from "../transport/types.js";
export type NetworkSnapshot = ReturnType<ReturnType<typeof import("../network/collector.js").createNetworkCollector>["snapshot"]>;
export declare function attachNetworkDebug(snapshot: () => NetworkSnapshot): () => void;
/** Local lifetime counters, including requests that exceed bounded aggregation capacity. */
export declare function getNetworkSnapshot(): {
    activeBuckets: number;
    activeFailureGroups: number;
    summaryOverflow: number;
    diagnosticOverflow: number;
    rejectedEvents: number;
    instrumentationFailures: number;
} | undefined;
