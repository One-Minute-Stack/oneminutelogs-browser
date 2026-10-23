"use client";
import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, } from "react";
import { createBrowserTrackingRuntime } from "../views/runtime.js";
const OMLContext = createContext(undefined);
const NavigationContext = createContext(undefined);
const unavailable = () => ({
    status: "unavailable",
    reason: "Provider not initialized",
});
/** Wrap the application once. Browser initialization happens only after mount. */
export function OMLProvider({ children, viewOptions, rumEndpoint, transportEnabled, endpointTemplates, slowRequestThresholdMs, }) {
    const [session, setSession] = useState({
        status: "initializing",
    });
    const [pageContext, setPageContext] = useState();
    const managerRef = useRef(null);
    const initialOptions = useRef(viewOptions);
    const initialNetwork = useRef({ endpointTemplates, slowRequestThresholdMs });
    const initialTransport = useRef({ rumEndpoint, transportEnabled });
    const commitNavigation = useCallback((input) => managerRef.current?.commitNavigation(input) ?? Promise.resolve(), []);
    useEffect(() => {
        let active = true;
        let cleanup;
        queueMicrotask(() => {
            if (!active)
                return;
            const manager = createBrowserTrackingRuntime(initialOptions.current, initialTransport.current, initialNetwork.current);
            managerRef.current = manager;
            const unsubscribe = manager.subscribe((status) => {
                if (active) {
                    setSession(status);
                    setPageContext(manager.getPageContext());
                }
            });
            cleanup = () => {
                unsubscribe();
                manager.dispose();
            };
            void manager.initialize();
        });
        return () => {
            active = false;
            cleanup?.();
            managerRef.current = null;
        };
    }, []);
    return createElement(OMLContext.Provider, {
        value: {
            session,
            pageContext,
            resume: () => managerRef.current?.resume() ?? Promise.resolve(unavailable()),
            recordMeaningfulActivity: () => managerRef.current?.recordMeaningfulActivity() ??
                Promise.resolve(unavailable()),
        },
    }, createElement(NavigationContext.Provider, { value: { commitNavigation, status: session.status } }, children));
}
/** Internal bridge used by the framework integration. */
export function useOMLNavigation() {
    const value = useContext(NavigationContext);
    if (!value)
        throw new Error("Navigation observer must be inside OMLProvider");
    return value;
}
export function useOMLSession() {
    const value = useContext(OMLContext);
    if (!value)
        throw new Error("useOMLSession must be used inside OMLProvider");
    return value;
}
/** Local context for diagnostics and temporary demo inspection; no telemetry is emitted. */
export function useOMLPageContext() {
    const value = useContext(OMLContext);
    if (!value)
        throw new Error("useOMLPageContext must be used inside OMLProvider");
    return value.pageContext;
}
