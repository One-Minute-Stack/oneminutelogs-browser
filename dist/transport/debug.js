const listeners = new Set();
let active;
let latest;
export function publishTransport(snapshot) {
    latest = snapshot;
    for (const listener of listeners) {
        try {
            listener(snapshot);
        }
        catch { /* isolated */ }
    }
}
export function attachTransportDebug(controls) {
    active = controls;
    return () => { if (active === controls)
        active = undefined; };
}
/** Temporary diagnostic API, never required by application integrations. */
export function subscribeTransport(listener) {
    listeners.add(listener);
    if (active)
        listener(active.getSnapshot());
    else if (latest)
        listener(latest);
    return () => { listeners.delete(listener); };
}
export function flushTransport() { active?.flush(); }
