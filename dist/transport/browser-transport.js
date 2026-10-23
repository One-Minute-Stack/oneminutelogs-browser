export function resolveEndpoint(endpoint, origin) {
    const url = new URL(endpoint, origin);
    if (url.origin !== origin || url.username || url.password || url.hash)
        throw new Error("RUM endpoint must be same-origin without credentials or fragments");
    return url.href;
}
export function retryAfter(value, now) {
    if (!value)
        return undefined;
    const seconds = /^\d+(\.\d+)?$/.test(value) ? Number(value) : NaN;
    const milliseconds = Number.isFinite(seconds)
        ? seconds * 1000
        : Date.parse(value) - now;
    return Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : undefined;
}
export function createBrowserSender(endpoint, fetcher = fetch, timeoutMs = 10_000) {
    return async (batch, keepalive) => {
        const abort = new AbortController();
        let timeout;
        try {
            const deadline = new Promise((_, reject) => {
                timeout = setTimeout(() => {
                    abort.abort();
                    reject(new Error("Request timeout"));
                }, timeoutMs);
            });
            // Race explicitly: a customer fetch wrapper may ignore AbortSignal.
            const response = await Promise.race([
                fetcher(endpoint, {
                    method: "POST",
                    body: batch.body,
                    headers: { "Content-Type": "application/json" },
                    credentials: "same-origin",
                    redirect: "error",
                    referrerPolicy: "no-referrer",
                    keepalive,
                    signal: abort.signal,
                }),
                deadline,
            ]);
            if (!response.ok)
                return {
                    state: [502, 504].includes(response.status) &&
                        response.headers.get("X-OML-Delivery") === "uncertain"
                        ? "uncertain"
                        : [408, 429, 500, 502, 503, 504].includes(response.status)
                            ? "retryable"
                            : "terminal",
                    reason: `HTTP ${response.status}`,
                    retryAfterMs: retryAfter(response.headers.get("Retry-After"), Date.now()),
                };
            // Bound both acknowledgement memory and the total request + body-read lifetime.
            const read = async () => {
                if (!response.body)
                    return "";
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let bytes = 0, text = "";
                try {
                    for (;;) {
                        const chunk = await reader.read();
                        if (chunk.done)
                            return text + decoder.decode();
                        bytes += chunk.value.byteLength;
                        if (bytes > 4096) {
                            void reader.cancel().catch(() => { });
                            throw new Error("Oversized acknowledgement");
                        }
                        text += decoder.decode(chunk.value, { stream: true });
                    }
                }
                finally {
                    reader.releaseLock();
                }
            };
            const acknowledgement = await Promise.race([read(), deadline]);
            const ack = JSON.parse(acknowledgement);
            return ack?.batchId === batch.batchId && ack.accepted === true
                ? { state: "accepted", reason: "Whole batch acknowledged" }
                : {
                    state: "uncertain",
                    reason: "Missing matching whole-batch acknowledgement",
                };
        }
        catch {
            return {
                state: "uncertain",
                reason: "Network, timeout or invalid acknowledgement",
            };
        }
        finally {
            clearTimeout(timeout);
        }
    };
}
