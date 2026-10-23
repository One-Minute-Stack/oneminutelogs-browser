import { normalizeNavigation } from "../views/navigation.js";
import { METHODS, } from "./types.js";
const layers = new WeakMap();
const own = (object, key) => {
    if (!object || typeof object !== "object")
        return undefined;
    const d = Object.getOwnPropertyDescriptor(object, key);
    return d && Object.hasOwn(d, "value") ? d.value : undefined;
};
/** Capture only safe metadata; custom URL coercion and request headers/bodies are never read. */
export function requestMetadata(input, init, observer) {
    let raw = input, requestMethod;
    if (typeof input !== "string") {
        raw = undefined;
        if (typeof Request !== "undefined")
            try {
                raw = Object.getOwnPropertyDescriptor(Request.prototype, "url")?.get?.call(input);
                requestMethod = Object.getOwnPropertyDescriptor(Request.prototype, "method")?.get?.call(input);
            }
            catch { }
        if (raw === undefined && typeof URL !== "undefined")
            try {
                raw = Object.getOwnPropertyDescriptor(URL.prototype, "href")?.get?.call(input);
            }
            catch { }
    }
    let endpoint = "unknown_endpoint";
    if (typeof raw === "string" && raw.length <= 16384)
        try {
            const url = new URL(raw, observer.origin);
            const rum = new URL(observer.rumEndpoint, observer.origin);
            if ((url.origin === rum.origin && url.pathname === rum.pathname) ||
                url.pathname.startsWith("/api/oneminutelogs/") ||
                url.pathname === "/api/v1/rum/batches" ||
                url.pathname === "/api/v2/rum/batches")
                return undefined;
            if (url.origin === observer.origin && !url.username && !url.password) {
                endpoint = normalizeNavigation({ pathname: url.pathname }, { routeTemplates: observer.options.endpointTemplates }).route;
                if (endpoint === "unknown_route")
                    endpoint = "unknown_endpoint";
            }
        }
        catch { }
    const descriptor = init && typeof init === "object"
        ? Object.getOwnPropertyDescriptor(init, "method")
        : undefined;
    const value = descriptor && !Object.hasOwn(descriptor, "value")
        ? "OTHER"
        : (own(init, "method") ?? requestMethod ?? "GET");
    const normalized = typeof value === "string" ? value.toUpperCase() : "";
    const method = METHODS.includes(normalized)
        ? normalized
        : "OTHER";
    return { endpoint, method };
}
/** One layer per browser window, shared across runtimes; teardown preserves later third-party wrappers. */
export function attachFetchObserver(target, observer, monotonicNow = () => performance.now(), wallNow = Date.now) {
    if (typeof target.fetch !== "function")
        return () => { };
    const subscription = {
        ...observer,
        origin: target.location.origin,
    };
    let layer = layers.get(target);
    if (layer && layer.observers.size === 0 && target.fetch !== layer.wrapper)
        layer = undefined;
    if (!layer) {
        const observers = new Set();
        const original = target.fetch;
        const statusGetter = typeof Response !== "undefined"
            ? Object.getOwnPropertyDescriptor(Response.prototype, "status")?.get
            : undefined;
        const signalGetter = typeof Request !== "undefined"
            ? Object.getOwnPropertyDescriptor(Request.prototype, "signal")?.get
            : undefined;
        const exceptionNameGetter = typeof DOMException !== "undefined"
            ? Object.getOwnPropertyDescriptor(DOMException.prototype, "name")?.get
            : undefined;
        const abortedGetter = typeof AbortSignal !== "undefined"
            ? Object.getOwnPropertyDescriptor(AbortSignal.prototype, "aborted")?.get
            : undefined;
        const wrapped = function (...args) {
            const starts = [];
            for (const observer of observers)
                try {
                    const context = observer.context();
                    if (!context)
                        continue;
                    const metadata = requestMetadata(args[0], args[1], observer);
                    if (!metadata)
                        continue;
                    let signal = own(args[1], "signal");
                    if (!signal)
                        try {
                            signal = signalGetter?.call(args[0]);
                        }
                        catch { }
                    starts.push({
                        observer,
                        meta: {
                            context: { ...context },
                            ...metadata,
                            timestamp: wallNow(),
                            durationMs: 0,
                            outcome: "http",
                            status: 0,
                        },
                        started: monotonicNow(),
                        signal,
                    });
                }
                catch { }
            // Delegate with untouched argument identities and receiver; synchronous throws remain synchronous.
            const promise = Reflect.apply(original, this, args);
            if (!starts.length)
                return promise;
            const finish = (response, reason) => {
                for (const start of starts)
                    if (observers.has(start.observer))
                        try {
                            let status = 0, aborted = false;
                            if (response)
                                status = statusGetter?.call(response) ?? 0;
                            else
                                try {
                                    aborted = !!abortedGetter?.call(start.signal);
                                }
                                catch { }
                            if (!response && !aborted)
                                try {
                                    aborted = exceptionNameGetter?.call(reason) === "AbortError";
                                }
                                catch { }
                            start.observer.record({
                                ...start.meta,
                                durationMs: Math.max(0, monotonicNow() - start.started),
                                status,
                                outcome: response
                                    ? "http"
                                    : aborted
                                        ? "aborted"
                                        : "transport_failure",
                            });
                        }
                        catch { }
            };
            try {
                return Promise.prototype.then.call(promise, (response) => {
                    finish(response);
                    return response;
                }, (reason) => {
                    finish(undefined, reason);
                    throw reason;
                });
            }
            catch {
                return promise;
            }
        };
        layer = { original, wrapper: wrapped, observers };
        try {
            target.fetch = wrapped;
        }
        catch {
            return () => { };
        }
        layers.set(target, layer);
    }
    layer.observers.add(subscription);
    return () => {
        layer.observers.delete(subscription);
        if (layer.observers.size === 0 && target.fetch === layer.wrapper) {
            try {
                target.fetch = layer.original;
                layers.delete(target);
            }
            catch { }
        }
    };
}
