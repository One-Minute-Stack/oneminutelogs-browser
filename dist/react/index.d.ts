import type { NetworkOptions } from "../network/types.js";
import type { ReactNode } from "react";
import type { NavigationInput, ViewOptions, PageContext } from "../views/types.js";
import type { SessionStatus } from "../session/types.js";
import type { TransportOptions } from "../transport/types.js";
export type OMLSessionStatus = SessionStatus | {
    status: "initializing";
};
interface OMLContextValue {
    session: OMLSessionStatus;
    pageContext: PageContext | undefined;
    /** Reconcile storage without extending activity. */
    resume(): Promise<SessionStatus>;
    recordMeaningfulActivity(): Promise<SessionStatus>;
}
/** Wrap the application once. Browser initialization happens only after mount. */
export declare function OMLProvider({ children, viewOptions, rumEndpoint, transportEnabled, endpointTemplates, slowRequestThresholdMs, }: {
    children: ReactNode;
    viewOptions?: ViewOptions;
} & TransportOptions & NetworkOptions): import("react").FunctionComponentElement<import("react").ProviderProps<OMLContextValue | undefined>>;
/** Internal bridge used by the framework integration. */
export declare function useOMLNavigation(): {
    commitNavigation(input: NavigationInput): Promise<void>;
    status: OMLSessionStatus["status"];
};
export declare function useOMLSession(): OMLContextValue;
/** Local context for diagnostics and temporary demo inspection; no telemetry is emitted. */
export declare function useOMLPageContext(): PageContext | undefined;
export {};
