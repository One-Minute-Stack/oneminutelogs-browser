import { randomId } from "../session/ids.js";
/** Local correlation only: no sink, events, clocks for duration, visibility state or timers. */
export function createPageContextManager(options = {}) {
    const id = options.id ?? randomId;
    const now = options.now ?? Date.now;
    let context;
    let navigation;
    return {
        sync(session, next) {
            const rotated = context && context.sessionId !== session.session.sessionId;
            if (context && !rotated && navigation?.key === next.key) {
                context = { ...context, route: next.route };
                navigation = { ...next };
                return;
            }
            try {
                const viewId = !context || rotated ? session.viewId : id();
                context = {
                    sessionId: session.session.sessionId,
                    tabId: session.tabId,
                    viewId,
                    route: next.route,
                    timestamp: now(),
                };
                navigation = { ...next };
            }
            catch {
                /* Context failure must not interrupt the application. */
            }
        },
        snapshot() {
            return context ? { ...context } : undefined;
        },
        dispose() {
            context = undefined;
            navigation = undefined;
        },
    };
}
