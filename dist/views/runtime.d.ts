import type { NetworkOptions } from "../network/types.js";
import type { ViewOptions } from "./types.js";
import type { TransportOptions } from "../transport/types.js";
/** Browser-only composition. Session/view coordination is independently testable. */
export declare function createBrowserTrackingRuntime(viewOptions?: ViewOptions, transportOptions?: TransportOptions, networkOptions?: NetworkOptions): {
    getNetworkSnapshot: () => {
        activeBuckets: number;
        activeFailureGroups: number;
        summaryOverflow: number;
        diagnosticOverflow: number;
        rejectedEvents: number;
        instrumentationFailures: number;
    } | undefined;
    initialize(): Promise<import("../index.js").SessionStatus>;
    dispose(): void;
    commitNavigation(input: import("./types.js").NavigationInput): Promise<void>;
    resume: () => Promise<import("../index.js").SessionStatus>;
    recordMeaningfulActivity: () => Promise<import("../index.js").SessionStatus>;
    getPageContext(): import("./types.js").PageContext | undefined;
    getSnapshot: () => import("../index.js").SessionStatus;
    subscribe(listener: (status: import("../index.js").SessionStatus) => void): () => void;
};
