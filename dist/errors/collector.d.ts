import type { PageContext } from "../views/types.js";
import type { JavaScriptErrorEvent } from "../transport/events.js";
import { type Diagnostic } from "./diagnostic.js";
export declare function createErrorCollector(options: {
    context(): PageContext | undefined;
    enqueue(event: JavaScriptErrorEvent): {
        accepted: boolean;
    };
    now?: () => number;
    id?: () => string;
    schedule?: (callback: () => void, ms: number) => unknown;
    cancel?: (timer: unknown) => void;
}): {
    capture(source: Diagnostic["source"], value: unknown, fallbackMessage?: unknown, filename?: unknown): void;
    flush: () => void;
    snapshot: () => {
        activeGroups: number;
        missingContext: number;
        overflow: number;
        rejected: number;
        excluded: number;
        instrumentationFailures: number;
    };
    dispose(): void;
};
/** Read native event fields via captured platform getters, never overridden instance properties. */
export declare function attachErrorListeners(target: Window, collector: ReturnType<typeof createErrorCollector>): () => void;
