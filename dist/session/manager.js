import { randomId } from "./ids.js";
export const SESSION_TIMEOUT_MS = 1_800_000;
function valid(value, now) {
    if (!value || typeof value !== "object")
        return false;
    const r = value;
    return r.version === 1 && typeof r.sessionId === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(r.sessionId) &&
        Number.isSafeInteger(r.startedAt) && r.startedAt >= 0 &&
        Number.isSafeInteger(r.lastMeaningfulActivityAt) && r.lastMeaningfulActivityAt >= r.startedAt &&
        r.lastMeaningfulActivityAt <= now && r.startedAt <= now &&
        Number.isSafeInteger(r.revision) && r.revision >= 0;
}
export function createSessionManager(options) {
    const now = options.now ?? Date.now;
    const id = options.id ?? randomId;
    let state = { status: "unavailable", reason: "Not initialized" };
    let tabId;
    let disposed = false;
    let tail = Promise.resolve();
    const listeners = new Set();
    const emit = () => { for (const listener of listeners) {
        try {
            listener(snapshot());
        }
        catch { /* isolate consumers */ }
    } };
    function run(activity, initialization = false, captured) {
        const capturedAt = captured?.at ?? now();
        const expected = captured ? captured.expected : state.status === "ready" ? state.session.sessionId : undefined;
        const task = async () => {
            if (disposed)
                return { status: "unavailable", reason: "Disposed" };
            try {
                tabId ??= id();
                let changed = false;
                const record = await options.store.update(current => {
                    const checkedAt = now();
                    if (!Number.isSafeInteger(checkedAt) || checkedAt < 0)
                        throw new Error("Invalid clock");
                    if (!valid(current, checkedAt) || checkedAt - current.lastMeaningfulActivityAt >= SESSION_TIMEOUT_MS) {
                        changed = true;
                        return { version: 1, sessionId: id(), startedAt: checkedAt,
                            lastMeaningfulActivityAt: checkedAt, revision: 0 };
                    }
                    // Captured activity can only affect the generation the caller observed.
                    if (activity && (expected === current.sessionId || (initialization && expected === undefined)) &&
                        capturedAt >= current.startedAt && capturedAt <= checkedAt && capturedAt > current.lastMeaningfulActivityAt) {
                        changed = true;
                        return { ...current, lastMeaningfulActivityAt: capturedAt, revision: current.revision + 1 };
                    }
                    return current;
                });
                if (disposed)
                    return { status: "unavailable", reason: "Disposed" };
                const viewId = state.status === "ready" && state.session.sessionId === record.sessionId
                    ? state.viewId : id();
                state = { status: "ready", session: { ...record }, tabId, viewId };
                if (changed) {
                    try {
                        options.notifications?.publish();
                    }
                    catch { /* notification is optional */ }
                }
            }
            catch {
                state = { status: "unavailable", reason: "Session storage or cryptography unavailable" };
            }
            emit();
            return snapshot();
        };
        const result = tail.then(task, task);
        tail = result;
        return result;
    }
    function snapshot() {
        return state.status === "ready" ? { ...state, session: { ...state.session } } : { ...state };
    }
    const unsubscribe = options.notifications?.subscribe(() => { void run(false); });
    return {
        initialize: () => run(true, true),
        recordMeaningfulActivity: () => run(true),
        /** Internal deferred navigation support: retain the generation/time at actual commit. */
        captureMeaningfulActivity() {
            const captured = { at: now(), expected: state.status === "ready" ? state.session.sessionId : undefined };
            return () => run(true, false, captured);
        },
        resume: () => run(false),
        getSnapshot: snapshot,
        async createView() {
            await run(false);
            if (state.status === "ready") {
                try {
                    state = { ...state, viewId: id() };
                    emit();
                }
                catch {
                    state = { status: "unavailable", reason: "Cryptography unavailable" };
                }
            }
            return snapshot();
        },
        subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
        dispose() {
            disposed = true;
            unsubscribe?.();
            options.notifications?.close();
            options.store.close();
            listeners.clear();
        },
    };
}
