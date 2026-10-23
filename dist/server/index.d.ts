export interface BrowserRequestOptions {
    /** The existing OML API key. Never expose this value to OMLProvider. */
    apiKey: string | undefined;
    /** Use the same projectName configured in createLogger. Server-owned, never browser supplied. */
    projectName: string;
    /** Application environment. Server-owned; never read from browser headers. */
    environment: string;
    /** Explicit privacy-safe templates also configured on OMLProvider. Unknown routes stay unknown. */
    routeTemplates?: readonly string[];
    endpointTemplates?: readonly string[];
    /** Testing seam; normal integrations use the native server fetch. No URL configuration. */
    fetch?: typeof fetch;
}
/** No Clerk, logger, React, browser-manager or backend SDK dependency. No local event processing/storage. */
export declare function handleBrowserRequest(request: Request, options: BrowserRequestOptions): Promise<Response>;
