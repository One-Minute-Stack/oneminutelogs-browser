import { rumIngestionUrl } from "./config.js";
/** Development receipt endpoint exists; durable production ingestion remains a later milestone. */
const BODY_LIMIT = 64 * 1024;
const ACK_LIMIT = 4096;
class RequestFailure extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
const errorResponse = (status, message, headers) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store", ...headers } });
const uncertainResponse = (status, message) => errorResponse(status, message, { "X-OML-Delivery": "uncertain" });
async function boundedRead(body, limit, signal) {
    if (!body)
        return new Uint8Array();
    const reader = body.getReader();
    const cancel = () => {
        void reader.cancel().catch(() => { });
    };
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted)
        cancel();
    const chunks = [];
    let length = 0;
    try {
        for (;;) {
            const chunk = await reader.read();
            if (signal.aborted)
                throw new RequestFailure(504, "RUM forwarding cancelled");
            if (chunk.done)
                break;
            length += chunk.value.byteLength;
            if (length > limit)
                throw new RequestFailure(413, "Request body too large");
            chunks.push(chunk.value);
        }
    }
    finally {
        signal.removeEventListener("abort", cancel);
        void reader.cancel().catch(() => { });
        reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
    }
    return bytes;
}
/** No Clerk, logger, React, browser-manager or backend SDK dependency. No local event processing/storage. */
export async function handleBrowserRequest(request, options) {
    if (typeof window !== "undefined")
        throw new Error("@oneminutelogs/browser/server is server-only");
    if (request.method !== "POST")
        return errorResponse(405, "Only POST is supported", { Allow: "POST" });
    const apiKey = options.apiKey?.trim();
    if (!apiKey || /[\r\n]/.test(apiKey))
        return errorResponse(503, "RUM forwarding is not configured");
    const projectName = options.projectName
        ?.normalize("NFKC")
        .trim()
        .replace(/\s+/g, " ");
    if (!projectName ||
        [...projectName].length > 120 ||
        /[\u0000-\u001f\u007f]/.test(projectName))
        return errorResponse(503, "RUM forwarding is not configured");
    const environment = typeof options.environment === "string" ? options.environment.trim() : "";
    if (!environment || environment.length > 128 || !/^[A-Za-z0-9_.-]+$/.test(environment))
        return errorResponse(503, "RUM environment is not configured");
    const routeTemplates = options.routeTemplates ?? [];
    const endpointTemplates = options.endpointTemplates ?? [];
    if (!Array.isArray(routeTemplates) || !Array.isArray(endpointTemplates))
        return errorResponse(503, "RUM forwarding is not configured");
    const templates = [...routeTemplates, ...endpointTemplates];
    if (!Array.isArray(routeTemplates) ||
        !Array.isArray(endpointTemplates) ||
        endpointTemplates.length > 64 ||
        routeTemplates.length > 64 ||
        templates.some((route) => typeof route !== "string" ||
            route.length > 256 ||
            !(route === "/" ||
                /^\/(?:[A-Za-z0-9_-]+|\[(?:\.\.\.)?[A-Za-z0-9_]+\]|\[\[\.\.\.[A-Za-z0-9_]+\]\])(?:\/(?:[A-Za-z0-9_-]+|\[(?:\.\.\.)?[A-Za-z0-9_]+\]|\[\[\.\.\.[A-Za-z0-9_]+\]\]))*$/.test(route))) ||
        JSON.stringify(routeTemplates).length > 8192 ||
        JSON.stringify(endpointTemplates).length > 8192)
        return errorResponse(503, "RUM forwarding is not configured");
    try {
        const origin = request.headers.get("Origin");
        // Next.js can normalize Request.url to its listening hostname in development.
        // Host is the incoming authority; do not trust arbitrary X-Forwarded-Host values.
        const requestUrl = new URL(request.url);
        const host = request.headers.get("Host");
        if (host) {
            const authority = new URL(`${requestUrl.protocol}//${host}`);
            if (authority.host !== host.toLowerCase() ||
                authority.username ||
                authority.password)
                return errorResponse(400, "Invalid request authority");
            requestUrl.host = authority.host;
        }
        if ((origin !== null && origin !== requestUrl.origin) ||
            request.headers.get("Sec-Fetch-Site") === "cross-site")
            return errorResponse(403, "Cross-origin submissions are not supported");
        if (request.headers
            .get("Content-Type")
            ?.split(";")[0]
            ?.trim()
            .toLowerCase() !== "application/json")
            return errorResponse(415, "Content-Type must be application/json");
        const encoding = request.headers.get("Content-Encoding");
        if (encoding && encoding.toLowerCase() !== "identity")
            return errorResponse(415, "Encoded request bodies are not supported");
        const declared = request.headers.get("Content-Length");
        if (declared !== null) {
            if (!/^\d+$/.test(declared))
                return errorResponse(400, "Invalid Content-Length");
            if (Number(declared) > BODY_LIMIT)
                return errorResponse(413, "Request body too large");
        }
        const abort = new AbortController();
        let timer;
        const aborted = () => abort.abort();
        request.signal.addEventListener("abort", aborted, { once: true });
        if (request.signal.aborted)
            abort.abort();
        try {
            // One deadline bounds inbound reading, forwarding and upstream acknowledgement reading.
            const deadline = new Promise((_, reject) => {
                timer = setTimeout(() => {
                    abort.abort();
                    reject(new RequestFailure(504, "RUM forwarding timed out"));
                }, 5000);
            });
            const forward = async () => {
                const bytes = await boundedRead(request.body, BODY_LIMIT, abort.signal);
                let envelope;
                try {
                    envelope = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
                }
                catch {
                    return errorResponse(400, "Invalid JSON batch");
                }
                if (!envelope ||
                    envelope.schemaVersion !== 1 ||
                    typeof envelope.batchId !== "string" ||
                    !envelope.batchId.length ||
                    envelope.batchId.length > 128 ||
                    !Array.isArray(envelope.events) ||
                    !envelope.events.length ||
                    envelope.events.length > 1000 ||
                    envelope.events.some((event) => !event || typeof event !== "object" || Array.isArray(event)))
                    return errorResponse(400, "Invalid batch envelope");
                const upstream = await (options.fetch ?? fetch)(rumIngestionUrl(), {
                    method: "POST",
                    body: bytes,
                    signal: abort.signal,
                    redirect: "error",
                    credentials: "omit",
                    cache: "no-store",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                        "x-api-key": apiKey,
                        "x-oml-project-name": encodeURIComponent(projectName),
                        "x-oml-environment": environment,
                        "x-oml-route-templates": JSON.stringify(routeTemplates),
                        "x-oml-endpoint-templates": JSON.stringify(endpointTemplates),
                    },
                });
                if (!upstream.ok) {
                    void upstream.body?.cancel().catch(() => { });
                    const headers = {};
                    const retryAfter = upstream.headers.get("Retry-After");
                    if (retryAfter &&
                        retryAfter.length <= 128 &&
                        (/^\d+$/.test(retryAfter) ||
                            Number.isFinite(Date.parse(retryAfter))))
                        headers["Retry-After"] = retryAfter;
                    // Never relay redirects, upstream bodies or Set-Cookie/credential-bearing headers.
                    return errorResponse(upstream.status >= 300 && upstream.status < 400
                        ? 502
                        : upstream.status, "RUM upstream rejected the batch", headers);
                }
                let ack;
                try {
                    ack = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await boundedRead(upstream.body, ACK_LIMIT, abort.signal)));
                }
                catch {
                    return uncertainResponse(502, "Invalid upstream acknowledgement");
                }
                if (ack?.batchId !== envelope.batchId || ack.accepted !== true)
                    return uncertainResponse(502, "Missing matching whole-batch acknowledgement");
                return Response.json({ batchId: envelope.batchId, accepted: true }, { headers: { "Cache-Control": "no-store" } });
            };
            return await Promise.race([forward(), deadline]);
        }
        finally {
            clearTimeout(timer);
            abort.abort();
            request.signal.removeEventListener("abort", aborted);
        }
    }
    catch (error) {
        const respond = error instanceof RequestFailure && error.status === 413
            ? errorResponse
            : uncertainResponse;
        return respond(error instanceof RequestFailure ? error.status : 502, error instanceof RequestFailure ? error.message : "RUM forwarding failed");
    }
}
