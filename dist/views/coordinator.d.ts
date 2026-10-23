import type { createSessionManager } from "../session/manager.js";
import type { SessionStatus } from "../session/types.js";
import type { createPageContextManager } from "./manager.js";
import type { NavigationInput, ViewOptions } from "./types.js";
/** Serialize committed navigation and reconcile session rotation without duplicate views. */
export declare function createTrackingCoordinator(sessions: ReturnType<typeof createSessionManager>, views?: ReturnType<typeof createPageContextManager>, viewOptions?: ViewOptions): {
    initialize: () => Promise<SessionStatus>;
    commitNavigation(input: NavigationInput): Promise<void>;
    resume: () => Promise<SessionStatus>;
    recordMeaningfulActivity: () => Promise<SessionStatus>;
    getPageContext(): import("./types.js").PageContext | undefined;
    getSnapshot: () => SessionStatus;
    subscribe(listener: (status: SessionStatus) => void): () => void;
    dispose(): void;
};
