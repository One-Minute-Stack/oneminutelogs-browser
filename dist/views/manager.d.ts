import type { SessionStatus } from "../session/types.js";
import type { NavigationState, PageContext } from "./types.js";
type Ready = Extract<SessionStatus, {
    status: "ready";
}>;
/** Local correlation only: no sink, events, clocks for duration, visibility state or timers. */
export declare function createPageContextManager(options?: {
    now?: () => number;
    id?: () => string;
}): {
    sync(session: Ready, next: NavigationState): void;
    snapshot(): PageContext | undefined;
    dispose(): void;
};
export {};
