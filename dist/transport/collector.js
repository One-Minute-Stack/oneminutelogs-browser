import { randomId } from "../session/ids.js";
const encoder = new TextEncoder();
const size = (text) => encoder.encode(text).byteLength;
/** Per-runtime collector. Events are never coalesced or mutated; sealed bodies are immutable. */
export function createCollector(options) {
    const now = options.now ?? Date.now, id = options.id ?? randomId, random = options.random ?? Math.random;
    const maxEvents = options.maxEvents ?? 1000, maxBytes = options.maxBytes ?? 1024 * 1024;
    const batchBytes = options.batchBytes ?? 64 * 1024;
    const queue = [], pending = [];
    const listeners = new Set();
    let inFlight = false, closed = false, degraded = false;
    let acceptedEvents = 0, droppedEvents = 0, failedEvents = 0, attempts = 0;
    let lastDelivery;
    const failures = [];
    const envelope = (batchId, events) => JSON.stringify({ schemaVersion: 1, batchId, events });
    // Reserve one envelope per queued event: conservative accounting covers future sealing overhead.
    const cost = (event) => size(envelope("00000000-0000-4000-8000-000000000000", [event]));
    const bytes = () => queue.reduce((n, e) => n + e.bytes, 0) + pending.reduce((n, p) => n + p.batch.bytes, 0);
    const count = () => queue.length + pending.reduce((n, p) => n + p.batch.events.length, 0);
    const snapshot = () => ({ status: degraded ? "degraded" : "healthy", queued: queue.length,
        sealed: pending.reduce((n, p) => n + p.batch.events.length, 0), accountedBytes: bytes(),
        acceptedEvents, droppedEvents, failedEvents, attempts, lastDelivery,
        failures: failures.map(f => ({ ...f })) });
    const notify = () => { for (const listener of listeners) {
        try {
            listener(snapshot());
        }
        catch { /* diagnostic isolation */ }
    } };
    const drop = () => { droppedEvents++; degraded = true; };
    function enqueue(input) {
        if (closed)
            return { accepted: false, reason: "Collector disposed" };
        try {
            const event = Object.freeze({ ...input });
            const eventBytes = cost(event);
            if (eventBytes > batchBytes || eventBytes > maxBytes) {
                drop();
                notify();
                return { accepted: false, reason: "Individually oversized event" };
            }
            if (count() + 1 > maxEvents || bytes() + eventBytes > maxBytes) {
                drop();
                notify();
                return { accepted: false, reason: "Buffer capacity exhausted" };
            }
            queue.push({ event, bytes: eventBytes, at: now() });
            notify();
            if (queue.length >= 20 || queue.reduce((n, e) => n + e.bytes, 0) >= batchBytes)
                flush();
            return { accepted: true };
        }
        catch {
            drop();
            notify();
            return { accepted: false, reason: "Event serialization failed" };
        }
    }
    function fail(p, reason) {
        pending.splice(pending.indexOf(p), 1);
        failedEvents += p.batch.events.length;
        degraded = true;
        lastDelivery = { state: "terminal", reason };
        failures.push({ batchId: p.batch.batchId, eventCount: p.batch.events.length, reason });
        if (failures.length > 50)
            failures.shift();
    }
    function seal(limit) {
        while (queue.length) {
            const batchId = id();
            const events = [];
            while (queue.length) {
                const candidate = queue[0].event;
                if (size(envelope(batchId, [...events, candidate])) > limit)
                    break;
                events.push(queue.shift().event);
            }
            if (!events.length)
                break; // An event valid for ordinary fetch may exceed the keepalive budget.
            const body = envelope(batchId, events);
            const batch = Object.freeze({ batchId, events: Object.freeze(events), body, bytes: size(body) });
            pending.push({ batch, created: now(), due: now(), attempts: 0 });
        }
    }
    async function pump(keepalive) {
        if (closed || inFlight)
            return;
        for (const p of [...pending])
            if (now() - p.created >= 300_000)
                fail(p, "Retry lifetime exhausted");
        const p = pending.find(item => item.due <= now() && (!keepalive || item.batch.bytes <= 48 * 1024));
        if (!p) {
            notify();
            return;
        }
        inFlight = true;
        p.attempts++;
        attempts++;
        notify();
        let result;
        try {
            result = await options.send(p.batch, keepalive);
        }
        catch {
            result = { state: "uncertain", reason: "Sender failed" };
        }
        inFlight = false;
        if (closed)
            return;
        lastDelivery = result;
        if (result.state === "accepted") {
            acceptedEvents += p.batch.events.length;
            pending.splice(pending.indexOf(p), 1);
        }
        else if (result.state === "terminal" || p.attempts >= 5 || now() - p.created >= 300_000) {
            fail(p, result.state === "terminal" ? result.reason : "Retry budget exhausted: " + result.reason);
        }
        else {
            degraded = true;
            const jitter = Math.max(0, Math.min(1, random())) * Math.min(30_000, 1000 * 2 ** (p.attempts - 1));
            p.due = now() + Math.max(1, jitter, result.retryAfterMs ?? 0);
        }
        notify();
        // One keepalive per lifecycle hint: respect the shared browser quota.
        if (!keepalive)
            void pump(false);
    }
    function flush(keepalive = false) {
        if (closed)
            return;
        try {
            seal(keepalive ? Math.min(batchBytes, 48 * 1024) : batchBytes);
            void pump(keepalive);
        }
        catch {
            degraded = true;
            notify();
        }
    }
    return {
        enqueue, flush, getSnapshot: snapshot,
        tick() { if (closed)
            return; if (queue[0] && now() - queue[0].at >= 10_000)
            flush();
        else
            void pump(false); },
        subscribe(listener) { listeners.add(listener); listener(snapshot()); return () => { listeners.delete(listener); }; },
        dispose() { closed = true; queue.length = 0; pending.length = 0; listeners.clear(); },
    };
}
