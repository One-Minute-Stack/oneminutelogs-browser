import type { RumEvent } from "../transport/events.js";
import type { PageContext } from "../views/types.js";
export interface NetworkOptions {
    endpointTemplates?: readonly string[];
    slowRequestThresholdMs?: number;
}
export declare const METHODS: readonly ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "OTHER"];
export type Method = (typeof METHODS)[number];
export type Outcome = "http" | "transport_failure" | "aborted";
export interface Observation {
    context: PageContext;
    endpoint: string;
    method: Method;
    timestamp: number;
    durationMs: number;
    outcome: Outcome;
    status: number;
}
export interface StatusBuckets {
    other: number;
    "2xx": number;
    "3xx": number;
    "4xx": number;
    "5xx": number;
}
export interface NetworkSummary extends RumEvent {
    type: "network_summary";
    endpoint: string;
    method: Method;
    requests: number;
    statusBuckets: StatusBuckets;
    httpFailures: number;
    transportFailures: number;
    abortedRequests: number;
    slowRequests: number;
    totalLatencyMs: number;
    maxLatencyMs: number;
    averageLatencyMs: number;
    slowThresholdMs: number;
    firstSeenAt: number;
    lastSeenAt: number;
}
export interface NetworkError extends RumEvent {
    type: "network_error";
    endpoint: string;
    method: Method;
    reason: "http_5xx" | "transport_failure" | "slow_response";
    /** null means no HTTP response (transport failure); 0 is native opaque-response status. */
    status: number | null;
    occurrences: number;
    firstSeenAt: number;
    lastSeenAt: number;
    totalLatencyMs: number;
    maxLatencyMs: number;
    slowThresholdMs: number;
}
