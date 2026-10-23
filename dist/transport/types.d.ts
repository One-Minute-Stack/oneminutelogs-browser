import type { RumEvent } from "./events.js";
export declare const DEFAULT_RUM_ENDPOINT = "/api/oneminutelogs/browser";
export interface TransportOptions {
    rumEndpoint?: string;
    transportEnabled?: boolean;
}
export type DeliveryState = "accepted" | "retryable" | "uncertain" | "terminal";
export interface DeliveryResult {
    state: DeliveryState;
    reason: string;
    retryAfterMs?: number;
}
export interface FailureMetadata {
    batchId: string;
    eventCount: number;
    reason: string;
}
export interface TransportSnapshot {
    status: "healthy" | "degraded" | "disabled";
    queued: number;
    sealed: number;
    accountedBytes: number;
    acceptedEvents: number;
    droppedEvents: number;
    failedEvents: number;
    attempts: number;
    lastDelivery?: DeliveryResult;
    failures: readonly FailureMetadata[];
}
export interface Batch {
    batchId: string;
    events: readonly RumEvent[];
    body: string;
    bytes: number;
}
export type Sender = (batch: Batch, keepalive: boolean) => Promise<DeliveryResult>;
