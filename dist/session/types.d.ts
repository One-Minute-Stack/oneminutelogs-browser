export type SessionId = string & {
    readonly __sessionId: unique symbol;
};
export type TabId = string & {
    readonly __tabId: unique symbol;
};
export type ViewId = string & {
    readonly __viewId: unique symbol;
};
export interface SessionRecord {
    version: 1;
    sessionId: SessionId;
    startedAt: number;
    lastMeaningfulActivityAt: number;
    revision: number;
}
export type SessionStatus = {
    status: "ready";
    session: SessionRecord;
    tabId: TabId;
    viewId: ViewId;
} | {
    status: "unavailable";
    reason: string;
};
export interface SessionStore {
    /** Execute the synchronous decision within one readwrite transaction. Resolve after commit. */
    update(decide: (current: unknown) => SessionRecord): Promise<SessionRecord>;
    close(): void;
}
export interface Notifications {
    publish(): void;
    subscribe(listener: () => void): () => void;
    close(): void;
}
