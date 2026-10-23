export { subscribeTransport, flushTransport } from "../transport/debug.js";
let networkSnapshot;
export function attachNetworkDebug(snapshot) {
    networkSnapshot = snapshot;
    return () => {
        if (networkSnapshot === snapshot)
            networkSnapshot = undefined;
    };
}
/** Local lifetime counters, including requests that exceed bounded aggregation capacity. */
export function getNetworkSnapshot() {
    return networkSnapshot?.();
}
