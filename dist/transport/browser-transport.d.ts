import type { Sender } from "./types.js";
export declare function resolveEndpoint(endpoint: string, origin: string): string;
export declare function retryAfter(value: string | null, now: number): number | undefined;
export declare function createBrowserSender(endpoint: string, fetcher?: typeof fetch, timeoutMs?: number): Sender;
