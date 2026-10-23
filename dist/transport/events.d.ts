import type { PageContext } from "../views/types.js";
/** JavaScript errors and fetch health are enabled; page telemetry is retired. */
export type HealthEventType = "javascript_error" | "network_error" | "network_summary";
/** Common transport boundary; each future collector must add a validated, privacy-safe payload. */
export interface RumEvent extends PageContext {
    schemaVersion: 2;
    eventId: string;
    type: HealthEventType;
}
export interface JavaScriptErrorEvent extends RumEvent {
    type: "javascript_error";
    source: "exception" | "unhandled_rejection";
    name: string;
    message: string;
    frames: import("../errors/diagnostic.js").StackFrame[];
    fingerprint: string;
    occurrences: number;
    firstSeenAt: number;
    lastSeenAt: number;
}
