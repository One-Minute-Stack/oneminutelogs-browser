# @oneminutelogs/browser

Browser health monitoring for OneMinute Logs. Automatically capture sanitized JavaScript errors and `window.fetch` request counts, failures, and latency, with anonymous session and page context.

Telemetry is batched and sent through your application's server endpoint. API keys stay on the server. The SDK does not collect input values, request or response bodies, cookies, raw URLs, or arbitrary error messages.

## Install

```bash
npm install @oneminutelogs/browser
```

## Use with Next.js

Wrap your application with the provider:

```tsx
// app/providers.tsx
"use client";

import type { ReactNode } from "react";
import { OMLProvider } from "@oneminutelogs/browser/next";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <OMLProvider
      routeTemplates={["/", "/jobs/[id]"]}
      endpointTemplates={["/api/jobs/[id]"]}
    >
      {children}
    </OMLProvider>
  );
}
```

```tsx
// app/layout.tsx
import type { ReactNode } from "react";
import { Providers } from "./providers";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
```

Add the server endpoint using your OML API key:

```ts
// app/api/oneminutelogs/browser/route.ts
import { handleBrowserRequest } from "@oneminutelogs/browser/server";

export function POST(request: Request) {
  return handleBrowserRequest(request, {
    apiKey: process.env.ONE_MINUTE_LOGS_API_KEY,
    projectName: "my-app",
    environment: process.env.NODE_ENV || "development",
    routeTemplates: ["/", "/jobs/[id]"],
    endpointTemplates: ["/api/jobs/[id]"],
  });
}
```

Keep `ONE_MINUTE_LOGS_API_KEY` server-only; never prefix it with `NEXT_PUBLIC_`. Use the same project name as your backend logger and matching templates in the provider and server handler. Templates should contain placeholders, not personal identifiers.

If you already use the `@oneminutelogs/next` catch-all forwarder, enable its `browser` option instead of adding a separate endpoint.

## Options

| Provider option | Purpose |
| --- | --- |
| `routeTemplates` | Safe page patterns, such as `/jobs/[id]`. Unmatched pages use `unknown_route`. |
| `endpointTemplates` | Safe same-origin API patterns. Unmatched requests use `unknown_endpoint`. |
| `slowRequestThresholdMs` | Slow-request threshold; defaults to `5000` ms. |
| `significantQueryParams` | Query parameters that indicate navigation. Values are compared locally, not transmitted. |

Monitoring starts after mount. Errors and fetch outcomes are grouped and batched, so delivery is not immediate. An idle page with no errors or requests sends nothing, and the SDK excludes its own transport requests.

Fetch latency measures time until the promise settles, not response-body download time. XMLHttpRequest and session replay are not collected.
