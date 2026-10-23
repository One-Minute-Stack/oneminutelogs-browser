import type { NetworkError, NetworkSummary, Observation } from "./types.js";
export declare function createNetworkCollector(options: {
    enqueue(event: NetworkSummary | NetworkError): {
        accepted: boolean;
    };
    slowThresholdMs?: number;
    id?: () => string;
    schedule?: (fn: () => void, ms: number) => unknown;
    cancel?: (timer: unknown) => void;
}): {
    record(input: Observation): void;
    flush: () => void;
    snapshot: () => {
        activeBuckets: number;
        activeFailureGroups: number;
        summaryOverflow: number;
        diagnosticOverflow: number;
        rejectedEvents: number;
        instrumentationFailures: number;
    };
    dispose(): void;
};
