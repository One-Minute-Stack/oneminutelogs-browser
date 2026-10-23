"use client";
import { createElement, Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation.js";
import { useRouter as useCompatRouter } from "next/compat/router.js";
import { OMLProvider as ReactProvider, useOMLNavigation, } from "../react/index.js";
function NavigationObserver() {
    const pathname = usePathname();
    const search = useSearchParams();
    const compatRouter = useCompatRouter();
    const frameworkTemplate = compatRouter?.isReady
        ? compatRouter.pathname
        : undefined;
    const routerReady = !compatRouter || (compatRouter.isReady && !compatRouter.isFallback);
    const { commitNavigation, status } = useOMLNavigation();
    const query = search?.toString() ?? "";
    useEffect(() => {
        if (!pathname || !routerReady || status !== "ready")
            return;
        let active = true;
        // StrictMode cleanup cancels its provisional observer before local context is committed.
        queueMicrotask(() => {
            if (active)
                void commitNavigation({ pathname, search: query, frameworkTemplate });
        });
        return () => {
            active = false;
        };
    }, [
        pathname,
        query,
        frameworkTemplate,
        routerReady,
        status,
        commitNavigation,
    ]);
    return null;
}
export function OMLProvider({ children, significantQueryParams, routeTemplates, rumEndpoint, transportEnabled, endpointTemplates, slowRequestThresholdMs, }) {
    return createElement(ReactProvider, {
        rumEndpoint,
        transportEnabled,
        endpointTemplates,
        slowRequestThresholdMs,
        viewOptions: { significantQueryParams, routeTemplates },
        children: [
            children,
            createElement(Suspense, { fallback: null, key: "oml-navigation" }, createElement(NavigationObserver)),
        ],
    });
}
