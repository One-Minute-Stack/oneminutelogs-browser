export { createSessionManager, SESSION_TIMEOUT_MS } from "./session/manager.js";
export { createBrowserSessionManager, attachBrowserLifecycle } from "./session/browser-lifecycle.js";
export { createIndexedDBStore } from "./session/indexeddb-store.js";
export type { SessionId, TabId, ViewId, SessionRecord, SessionStatus, SessionStore, Notifications } from "./session/types.js";
