import { normalizeNavigation } from "./navigation.js";
/** Serialize committed navigation and reconcile session rotation without duplicate views. */
export function createTrackingCoordinator(sessions, views, viewOptions) {
    const listeners = new Set();
    let navigation;
    let suppress = false;
    let disposed = false;
    let tail = Promise.resolve();
    function snapshot() {
        const status = sessions.getSnapshot();
        const view = views?.snapshot();
        return status.status === "ready" &&
            view?.sessionId === status.session.sessionId
            ? { ...status, viewId: view.viewId }
            : status;
    }
    function notify() {
        for (const listener of listeners) {
            try {
                listener(snapshot());
            }
            catch { }
        }
    }
    const unsubscribe = sessions.subscribe((status) => {
        if (disposed || suppress)
            return;
        if (status.status === "ready" && navigation)
            views?.sync(status, navigation);
        notify();
    });
    return {
        initialize: async () => {
            await sessions.initialize();
            return snapshot();
        },
        commitNavigation(input) {
            const next = normalizeNavigation(input, viewOptions);
            const activity = sessions.captureMeaningfulActivity();
            const task = async () => {
                if (disposed ||
                    !views ||
                    (navigation?.key === next.key && navigation?.route === next.route))
                    return;
                suppress = true;
                try {
                    // Initial loading already counts as navigation; only later commits extend activity.
                    if (navigation && navigation.key !== next.key)
                        await activity();
                    if (disposed)
                        return;
                    const status = sessions.getSnapshot();
                    if (status.status === "ready") {
                        views.sync(status, next);
                        navigation = next;
                    }
                }
                finally {
                    suppress = false;
                    if (!disposed)
                        notify();
                }
            };
            const result = tail.then(task, task);
            tail = result;
            return result;
        },
        resume: async () => {
            await sessions.resume();
            return snapshot();
        },
        recordMeaningfulActivity: async () => {
            await sessions.recordMeaningfulActivity();
            return snapshot();
        },
        getPageContext() {
            const status = sessions.getSnapshot();
            const context = views?.snapshot();
            return !disposed &&
                status.status === "ready" &&
                context?.sessionId === status.session.sessionId
                ? context
                : undefined;
        },
        getSnapshot: snapshot,
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        dispose() {
            disposed = true;
            unsubscribe();
            views?.dispose();
            sessions.dispose();
            listeners.clear();
        },
    };
}
