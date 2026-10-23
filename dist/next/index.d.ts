import type { NetworkOptions } from "../network/types.js";
import type { ReactNode } from "react";
import type { ViewOptions } from "../views/types.js";
import type { TransportOptions } from "../transport/types.js";
export declare function OMLProvider({ children, significantQueryParams, routeTemplates, rumEndpoint, transportEnabled, endpointTemplates, slowRequestThresholdMs, }: ViewOptions & TransportOptions & NetworkOptions & {
    children: ReactNode;
}): import("react").FunctionComponentElement<{
    children: ReactNode;
    viewOptions?: ViewOptions;
} & TransportOptions & NetworkOptions>;
