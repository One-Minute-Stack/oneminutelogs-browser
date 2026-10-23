import { createSessionManager } from "./manager.js";
/** Explicit browser initialization; importing this module performs no browser access. */
export declare function createBrowserSessionManager(): {
    initialize: () => Promise<import("./types.js").SessionStatus>;
    recordMeaningfulActivity: () => Promise<import("./types.js").SessionStatus>;
    captureMeaningfulActivity(): () => Promise<import("./types.js").SessionStatus>;
    resume: () => Promise<import("./types.js").SessionStatus>;
    getSnapshot: () => import("./types.js").SessionStatus;
    createView(): Promise<import("./types.js").SessionStatus>;
    subscribe(listener: (state: import("./types.js").SessionStatus) => void): () => void;
    dispose(): void;
};
export declare function attachBrowserLifecycle(manager: Pick<ReturnType<typeof createSessionManager>, "recordMeaningfulActivity" | "resume">, doc: Document, win: Window): () => void;
