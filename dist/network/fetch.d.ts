import type { PageContext } from "../views/types.js";
import { type Method, type NetworkOptions, type Observation } from "./types.js";
interface Observer {
    context(): PageContext | undefined;
    record(value: Observation): void;
    options: NetworkOptions;
    origin: string;
    rumEndpoint: string;
}
/** Capture only safe metadata; custom URL coercion and request headers/bodies are never read. */
export declare function requestMetadata(input: unknown, init: unknown, observer: Pick<Observer, "options" | "origin" | "rumEndpoint">): {
    endpoint: string;
    method: Method;
} | undefined;
/** One layer per browser window, shared across runtimes; teardown preserves later third-party wrappers. */
export declare function attachFetchObserver(target: Pick<Window, "fetch" | "location">, observer: Omit<Observer, "origin">, monotonicNow?: () => number, wallNow?: () => number): () => void;
export {};
