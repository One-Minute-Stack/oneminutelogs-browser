import { randomId } from "../session/ids.js";
import { sanitizeDiagnostic } from "./diagnostic.js";
export function createErrorCollector(options) {
    const groups = new Map();
    const now = options.now ?? Date.now, id = options.id ?? randomId;
    const schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms));
    const cancel = options.cancel ??
        ((timer) => clearTimeout(timer));
    let timer, disposed = false;
    const stats = {
        missingContext: 0,
        overflow: 0,
        rejected: 0,
        excluded: 0,
        instrumentationFailures: 0,
    };
    function flush() {
        if (timer !== undefined) {
            try {
                cancel(timer);
            }
            catch {
                stats.instrumentationFailures++;
            }
            timer = undefined;
        }
        const sealed = [...groups.values()];
        groups.clear();
        for (const group of sealed)
            try {
                const event = {
                    ...group.context,
                    ...group.diagnostic,
                    frames: group.diagnostic.frames.map((f) => Object.freeze({ ...f })),
                    schemaVersion: 2,
                    type: "javascript_error",
                    eventId: id(),
                    timestamp: group.firstSeenAt,
                    occurrences: group.occurrences,
                    firstSeenAt: group.firstSeenAt,
                    lastSeenAt: group.lastSeenAt,
                };
                Object.freeze(event.frames);
                Object.freeze(event);
                if (!options.enqueue(event).accepted)
                    stats.rejected += group.occurrences;
            }
            catch {
                stats.instrumentationFailures += group.occurrences;
            }
    }
    return {
        capture(source, value, fallbackMessage, filename) {
            if (disposed)
                return;
            try {
                const context = options.context();
                if (!context) {
                    stats.missingContext++;
                    return;
                }
                const diagnostic = sanitizeDiagnostic(source, value, fallbackMessage, filename);
                if (!diagnostic) {
                    stats.excluded++;
                    return;
                }
                const key = JSON.stringify([
                    context.sessionId,
                    context.viewId,
                    context.tabId,
                    context.route,
                    diagnostic.fingerprint,
                ]);
                const at = now();
                if (!Number.isSafeInteger(at) || at < 0) {
                    stats.instrumentationFailures++;
                    return;
                }
                const current = groups.get(key);
                if (current) {
                    if (current.occurrences < Number.MAX_SAFE_INTEGER)
                        current.occurrences++;
                    current.lastSeenAt = Math.max(current.lastSeenAt, at);
                }
                else {
                    if (groups.size >= 100) {
                        stats.overflow++;
                        return;
                    }
                    groups.set(key, {
                        context: { ...context },
                        diagnostic,
                        occurrences: 1,
                        firstSeenAt: at,
                        lastSeenAt: at,
                    });
                }
                if (timer === undefined)
                    timer = schedule(flush, 10_000);
            }
            catch {
                stats.instrumentationFailures++;
            }
        },
        flush,
        snapshot: () => ({ ...stats, activeGroups: groups.size }),
        dispose() {
            if (disposed)
                return;
            disposed = true;
            flush();
        },
    };
}
/** Read native event fields via captured platform getters, never overridden instance properties. */
export function attachErrorListeners(target, collector) {
    if (typeof ErrorEvent === "undefined" ||
        typeof PromiseRejectionEvent === "undefined" ||
        typeof target.addEventListener !== "function")
        return () => { };
    try {
        const read = (prototype, key) => Object.getOwnPropertyDescriptor(prototype, key)?.get;
        const getters = {
            error: read(ErrorEvent.prototype, "error"),
            message: read(ErrorEvent.prototype, "message"),
            filename: read(ErrorEvent.prototype, "filename"),
            reason: read(PromiseRejectionEvent.prototype, "reason"),
        };
        const exception = (event) => {
            try {
                if (!(event instanceof ErrorEvent))
                    return; // Resource loading failures are outside this milestone.
                collector.capture("exception", getters.error?.call(event), getters.message?.call(event), getters.filename?.call(event));
            }
            catch { }
        };
        const rejection = (event) => {
            try {
                collector.capture("unhandled_rejection", getters.reason?.call(event));
            }
            catch { }
        };
        target.addEventListener("error", exception);
        try {
            target.addEventListener("unhandledrejection", rejection);
        }
        catch {
            try {
                target.removeEventListener("error", exception);
            }
            catch { }
            return () => { };
        }
        return () => {
            try {
                target.removeEventListener("error", exception);
            }
            catch { }
            try {
                target.removeEventListener("unhandledrejection", rejection);
            }
            catch { }
        };
    }
    catch {
        return () => { };
    }
}
