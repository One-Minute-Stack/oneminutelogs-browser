import { randomId } from "../session/ids.js";
const buckets = () => ({ other: 0, "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 });
export function createNetworkCollector(options) {
    const configured = options.slowThresholdMs ?? 5000;
    const threshold = Number.isFinite(configured) && configured >= 1 && configured <= 3_600_000
        ? configured
        : 5000;
    const summaries = new Map(), errors = new Map();
    const schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms));
    const cancel = options.cancel ??
        ((timer) => clearTimeout(timer));
    const id = options.id ?? randomId;
    let timer, closed = false;
    const stats = {
        summaryOverflow: 0,
        diagnosticOverflow: 0,
        rejectedEvents: 0,
        instrumentationFailures: 0,
    };
    const range = (event, at) => {
        event.firstSeenAt = Math.min(event.firstSeenAt, at);
        event.lastSeenAt = Math.max(event.lastSeenAt, at);
    };
    function flush() {
        if (timer !== undefined) {
            try {
                cancel(timer);
            }
            catch {
                stats.instrumentationFailures++;
            }
            timer = undefined;
        }
        const sealed = [...summaries.values(), ...errors.values()];
        summaries.clear();
        errors.clear();
        for (const event of sealed)
            try {
                event.eventId = id();
                event.timestamp = event.firstSeenAt;
                if (event.type === "network_summary") {
                    event.averageLatencyMs = event.totalLatencyMs / event.requests;
                    Object.freeze(event.statusBuckets);
                }
                Object.freeze(event);
                if (!options.enqueue(event).accepted)
                    stats.rejectedEvents++;
            }
            catch {
                stats.instrumentationFailures++;
            }
    }
    return {
        record(input) {
            if (closed)
                return;
            try {
                const { context, endpoint, method, timestamp, durationMs, outcome, status, } = input;
                if (!Number.isSafeInteger(timestamp) ||
                    timestamp < 0 ||
                    !Number.isFinite(durationMs) ||
                    durationMs < 0)
                    return;
                const latency = Math.min(durationMs, 86_400_000);
                const key = JSON.stringify([
                    context.sessionId,
                    context.viewId,
                    context.tabId,
                    context.route,
                    endpoint,
                    method,
                ]);
                let summary = summaries.get(key);
                if (!summary) {
                    if (summaries.size >= 200) {
                        stats.summaryOverflow++;
                        return;
                    }
                    summary = {
                        ...context,
                        schemaVersion: 2,
                        type: "network_summary",
                        eventId: "",
                        timestamp,
                        endpoint,
                        method,
                        requests: 0,
                        statusBuckets: buckets(),
                        httpFailures: 0,
                        transportFailures: 0,
                        abortedRequests: 0,
                        slowRequests: 0,
                        totalLatencyMs: 0,
                        maxLatencyMs: 0,
                        averageLatencyMs: 0,
                        slowThresholdMs: threshold,
                        firstSeenAt: timestamp,
                        lastSeenAt: timestamp,
                    };
                    summaries.set(key, summary);
                }
                summary.requests++;
                range(summary, timestamp);
                summary.totalLatencyMs += latency;
                summary.maxLatencyMs = Math.max(summary.maxLatencyMs, latency);
                if (outcome === "http") {
                    const bucket = status >= 200 && status < 600
                        ? `${Math.floor(status / 100)}xx`
                        : "other";
                    summary.statusBuckets[bucket]++;
                    if (status >= 400)
                        summary.httpFailures++;
                }
                else if (outcome === "aborted")
                    summary.abortedRequests++;
                else
                    summary.transportFailures++;
                const slow = outcome === "http" && latency >= threshold;
                if (slow)
                    summary.slowRequests++;
                const reasons = outcome === "transport_failure"
                    ? ["transport_failure"]
                    : outcome === "http" && status >= 500
                        ? ["http_5xx"]
                        : [];
                if (slow)
                    reasons.push("slow_response");
                for (const reason of reasons) {
                    const errorKey = JSON.stringify([
                        key,
                        reason,
                        reason === "transport_failure" ? null : status,
                    ]);
                    let error = errors.get(errorKey);
                    if (!error) {
                        if (errors.size >= 100) {
                            stats.diagnosticOverflow++;
                            continue;
                        }
                        error = {
                            ...context,
                            schemaVersion: 2,
                            type: "network_error",
                            eventId: "",
                            timestamp,
                            endpoint,
                            method,
                            reason,
                            status: reason === "transport_failure" ? null : status,
                            occurrences: 0,
                            firstSeenAt: timestamp,
                            lastSeenAt: timestamp,
                            totalLatencyMs: 0,
                            maxLatencyMs: 0,
                            slowThresholdMs: threshold,
                        };
                        errors.set(errorKey, error);
                    }
                    error.occurrences++;
                    range(error, timestamp);
                    error.totalLatencyMs += latency;
                    error.maxLatencyMs = Math.max(error.maxLatencyMs, latency);
                }
                if (timer === undefined)
                    timer = schedule(flush, 10_000);
            }
            catch {
                stats.instrumentationFailures++;
            }
        },
        flush,
        snapshot: () => ({
            ...stats,
            activeBuckets: summaries.size,
            activeFailureGroups: errors.size,
        }),
        dispose() {
            if (closed)
                return;
            closed = true;
            flush();
        },
    };
}
