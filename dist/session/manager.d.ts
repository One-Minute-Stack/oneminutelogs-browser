import type { Notifications, SessionStatus, SessionStore } from "./types.js";
export declare const SESSION_TIMEOUT_MS = 1800000;
export declare function createSessionManager(options: {
    store: SessionStore;
    now?: () => number;
    id?: () => string;
    notifications?: Notifications;
}): {
    initialize: () => Promise<SessionStatus>;
    recordMeaningfulActivity: () => Promise<SessionStatus>;
    /** Internal deferred navigation support: retain the generation/time at actual commit. */
    captureMeaningfulActivity(): () => Promise<SessionStatus>;
    resume: () => Promise<SessionStatus>;
    getSnapshot: () => SessionStatus;
    createView(): Promise<SessionStatus>;
    subscribe(listener: (state: SessionStatus) => void): () => void;
    dispose(): void;
};
