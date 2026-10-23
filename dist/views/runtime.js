import { attachNetworkDebug } from "../debug/index.js";
import { createNetworkCollector } from "../network/collector.js";
import { attachFetchObserver } from "../network/fetch.js";
import { createErrorCollector, attachErrorListeners, } from "../errors/collector.js";
import { createBrowserSessionManager, attachBrowserLifecycle, } from "../session/browser-lifecycle.js";
import { createPageContextManager } from "./manager.js";
import { createTrackingCoordinator } from "./coordinator.js";
import { attachTransportLifecycle } from "../transport/browser-lifecycle.js";
import { DEFAULT_RUM_ENDPOINT } from "../transport/types.js";
import { createCollector } from "../transport/collector.js";
import { createBrowserSender, resolveEndpoint, } from "../transport/browser-transport.js";
import { attachTransportDebug, publishTransport } from "../transport/debug.js";
/** Browser-only composition. Session/view coordination is independently testable. */
export function createBrowserTrackingRuntime(viewOptions, transportOptions, networkOptions) {
    const sessions = createBrowserSessionManager();
    let collector;
    let detachDebug;
    let unsubscribeTransport;
    let transportTimer;
    if (transportOptions?.transportEnabled !== false &&
        typeof window !== "undefined") {
        try {
            collector = createCollector({
                now: () => performance.now(),
                send: createBrowserSender(resolveEndpoint(transportOptions?.rumEndpoint ?? DEFAULT_RUM_ENDPOINT, window.location.origin)),
            });
            detachDebug = attachTransportDebug(collector);
            unsubscribeTransport = collector.subscribe((snapshot) => {
                publishTransport(snapshot);
                if (snapshot.queued || snapshot.sealed) {
                    transportTimer ??= setInterval(() => collector?.tick(), 250);
                }
                else {
                    clearInterval(transportTimer);
                    transportTimer = undefined;
                }
            });
        }
        catch {
            publishTransport({
                status: "disabled",
                queued: 0,
                sealed: 0,
                accountedBytes: 0,
                acceptedEvents: 0,
                droppedEvents: 0,
                failedEvents: 0,
                attempts: 0,
                failures: [],
                lastDelivery: {
                    state: "terminal",
                    reason: "Invalid endpoint or browser transport unavailable",
                },
            });
        }
    }
    else if (typeof window !== "undefined") {
        publishTransport({
            status: "disabled",
            queued: 0,
            sealed: 0,
            accountedBytes: 0,
            acceptedEvents: 0,
            droppedEvents: 0,
            failedEvents: 0,
            attempts: 0,
            failures: [],
        });
    }
    const views = typeof document !== "undefined" ? createPageContextManager() : undefined;
    const coordinator = createTrackingCoordinator(sessions, views, viewOptions);
    const errors = collector && typeof window !== "undefined"
        ? createErrorCollector({
            context: () => coordinator.getPageContext(),
            enqueue: (event) => collector.enqueue(event),
        })
        : undefined;
    const detachErrors = errors && typeof window !== "undefined"
        ? attachErrorListeners(window, errors)
        : undefined;
    const network = collector && typeof window !== "undefined"
        ? createNetworkCollector({
            enqueue: (event) => collector.enqueue(event),
            slowThresholdMs: networkOptions?.slowRequestThresholdMs,
        })
        : undefined;
    const detachFetch = network && typeof window !== "undefined"
        ? attachFetchObserver(window, {
            context: () => coordinator.getPageContext(),
            record: network.record,
            options: networkOptions ?? {},
            rumEndpoint: transportOptions?.rumEndpoint ?? DEFAULT_RUM_ENDPOINT,
        })
        : undefined;
    const detachNetworkDebug = network
        ? attachNetworkDebug(network.snapshot)
        : undefined;
    let disposed = false;
    let detachSession;
    const detachTransport = typeof document !== "undefined" && typeof window !== "undefined"
        ? attachTransportLifecycle(document, window, () => {
            errors?.flush();
            network?.flush();
            collector?.flush(true);
        })
        : undefined;
    return {
        ...coordinator,
        getNetworkSnapshot: () => network?.snapshot(),
        async initialize() {
            const result = await coordinator.initialize();
            if (!disposed &&
                result.status === "ready" &&
                typeof window !== "undefined" &&
                window.location.pathname)
                await coordinator.commitNavigation({
                    pathname: window.location.pathname,
                    search: window.location.search,
                });
            if (!disposed &&
                result.status === "ready" &&
                typeof document !== "undefined")
                detachSession = attachBrowserLifecycle(coordinator, document, window);
            return coordinator.getSnapshot();
        },
        dispose() {
            disposed = true;
            detachFetch?.();
            detachNetworkDebug?.();
            network?.dispose();
            detachErrors?.();
            errors?.dispose();
            detachSession?.();
            detachTransport?.();
            coordinator.dispose();
            // Best-effort delivery of existing diagnostics; disposal produces no event.
            collector?.flush(true);
            clearInterval(transportTimer);
            detachDebug?.();
            unsubscribeTransport?.();
            collector?.dispose();
        },
    };
}
