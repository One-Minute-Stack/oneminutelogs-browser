function safeTemplate(template) {
    return template.startsWith("/") && !/[?#:@\\\s%]/.test(template) &&
        template.split("/").every(part => /^[A-Za-z0-9_-]*$/.test(part) || /^\[(?:\.\.\.)?[A-Za-z0-9_]+\]$/.test(part) || /^\[\[\.\.\.[A-Za-z0-9_]+\]\]$/.test(part));
}
function match(template, pathname) {
    const parts = template.split("/").slice(1);
    const actual = pathname.split("/").slice(1);
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (/^\[\[\.\.\./.test(part))
            return i === parts.length - 1;
        if (/^\[\.\.\./.test(part))
            return i === parts.length - 1 && actual.length > i;
        if (actual[i] === undefined || actual[i] === "")
            return part === "" && actual[i] === "";
        if (!/^\[/.test(part) && part !== actual[i])
            return false;
    }
    return actual.length === parts.length;
}
export function normalizeNavigation(input, options = {}) {
    // Do not interpret absolute or credential-bearing URLs as pathnames.
    const pathname = input.pathname.startsWith("/") && !input.pathname.startsWith("//") && !/[?#\\]/.test(input.pathname)
        ? input.pathname.replace(/\/+$/, "") || "/" : "";
    const params = new URLSearchParams(input.search ?? "");
    const significant = [...new Set(options.significantQueryParams ?? [])].sort();
    // Key ordering is normalized; repeated value order is preserved since it can be meaningful.
    const key = JSON.stringify([pathname, significant.map(name => [name, params.getAll(name)])]);
    const templates = options.routeTemplates ?? [];
    const framework = input.frameworkTemplate;
    const route = pathname && framework && safeTemplate(framework) && match(framework, pathname) ? framework
        : templates.find(template => pathname && safeTemplate(template) && match(template, pathname)) ?? "unknown_route";
    return { key, route };
}
