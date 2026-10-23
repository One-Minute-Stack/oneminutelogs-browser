import type { SessionId, TabId, ViewId } from "../session/types.js";
/** Local-only correlation context. Creating or changing it never sends telemetry. */
export interface PageContext {
    sessionId: SessionId;
    tabId: TabId;
    viewId: ViewId;
    route: string;
    /** Context creation time; future diagnostic events supply their own occurrence timestamp. */
    timestamp: number;
}
export interface NavigationInput {
    pathname: string;
    search?: string;
    /** Only pass a template actually provided by a framework, never a guessed URL. */
    frameworkTemplate?: string;
}
export interface ViewOptions {
    significantQueryParams?: readonly string[];
    routeTemplates?: readonly string[];
}
export interface NavigationState {
    /** Local-only. Never included in telemetry. */
    key: string;
    route: string;
}
