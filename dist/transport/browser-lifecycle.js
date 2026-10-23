/** Lifecycle hints flush existing diagnostics only. They never create telemetry. */
export function attachTransportLifecycle(doc, win, flush) {
    const visibility = () => { if (doc.visibilityState === "hidden")
        flush(); };
    doc.addEventListener("visibilitychange", visibility);
    win.addEventListener("pagehide", flush);
    return () => {
        doc.removeEventListener("visibilitychange", visibility);
        win.removeEventListener("pagehide", flush);
    };
}
