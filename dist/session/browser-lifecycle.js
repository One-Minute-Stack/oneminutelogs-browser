import { createSessionManager } from "./manager.js";
import { createIndexedDBStore } from "./indexeddb-store.js";
/** Explicit browser initialization; importing this module performs no browser access. */
export function createBrowserSessionManager() {
    const unavailable = { update: async () => { throw new Error("IndexedDB unavailable"); }, close() { } };
    let store = unavailable;
    let notifications;
    try {
        if (typeof window !== "undefined" && window.indexedDB)
            store = createIndexedDBStore(window.indexedDB);
    }
    catch { /* storage access can throw */ }
    try {
        if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
            const channel = new BroadcastChannel("oml-session-v1");
            notifications = {
                publish: () => channel.postMessage(null),
                subscribe(listener) {
                    const handler = () => listener();
                    channel.addEventListener("message", handler);
                    return () => channel.removeEventListener("message", handler);
                },
                close: () => channel.close(),
            };
        }
    }
    catch { /* notifications are optional */ }
    return createSessionManager({ store, notifications });
}
export function attachBrowserLifecycle(manager, doc, win) {
    const activity = (event) => { if (event.isTrusted)
        void manager.recordMeaningfulActivity(); };
    const visible = () => { if (doc.visibilityState === "visible")
        void manager.resume(); };
    const resume = () => { void manager.resume(); };
    doc.addEventListener("pointerdown", activity, { passive: true });
    doc.addEventListener("keydown", activity, { passive: true });
    doc.addEventListener("visibilitychange", visible);
    win.addEventListener("pageshow", resume);
    return () => {
        doc.removeEventListener("pointerdown", activity);
        doc.removeEventListener("keydown", activity);
        doc.removeEventListener("visibilitychange", visible);
        win.removeEventListener("pageshow", resume);
    };
}
