export const ERROR_NAMES = [
    "Error",
    "TypeError",
    "ReferenceError",
    "SyntaxError",
    "RangeError",
    "URIError",
    "EvalError",
    "AggregateError",
];
export const ERROR_MESSAGES = [
    "JavaScript exception",
    "Unhandled promise rejection",
    "Cannot read properties of undefined",
    "Cannot read properties of null",
    "Value is not a function",
    "Value is not defined",
    "Assignment to constant variable",
    "Maximum call stack size exceeded",
    "Invalid array length",
    "Unexpected token",
    "Invalid URL",
];
export const extensionSource = (text) => /(?:chrome|moz|safari|safari-web)-extension:\/\//i.test(text);
// Only own data descriptors: never invoke getters, toString, toJSON or a rejection's prototype.
function data(value, key) {
    if (!value || typeof value !== "object")
        return undefined;
    try {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
    }
    catch {
        return undefined;
    }
}
export function diagnosticFingerprint(value) {
    const text = JSON.stringify([
        value.source,
        value.name,
        value.message,
        value.frames.map((f) => [f.file, f.line, f.column]),
    ]);
    const words = [2166136261, 2246822507, 3266489909, 668265263];
    return ("js1:" +
        words
            .map((seed) => {
            let hash = seed;
            for (let n = 0; n < text.length; n++)
                hash = Math.imul(hash ^ text.charCodeAt(n), 16777619);
            return (hash >>> 0).toString(16).padStart(8, "0");
        })
            .join(""));
}
export function safeMessage(raw, source) {
    if (typeof raw !== "string")
        return source === "exception" ? ERROR_MESSAGES[0] : ERROR_MESSAGES[1];
    // Engine labels only; no arbitrary text, quoted property names or application identifiers.
    if (/^Cannot read properties of undefined(?:\s|$)/.test(raw))
        return ERROR_MESSAGES[2];
    if (/^Cannot read properties of null(?:\s|$)/.test(raw))
        return ERROR_MESSAGES[3];
    if (/^[A-Za-z_$][\w.$]* is not a function$/.test(raw))
        return ERROR_MESSAGES[4];
    if (/^[A-Za-z_$][\w$]* is not defined$/.test(raw))
        return ERROR_MESSAGES[5];
    for (const label of ERROR_MESSAGES.slice(6))
        if (raw === label ||
            (label === "Unexpected token" && raw.startsWith(label)))
            return label;
    return source === "exception" ? ERROR_MESSAGES[0] : ERROR_MESSAGES[1];
}
export function sanitizeFrames(raw) {
    if (typeof raw !== "string")
        return [];
    const frames = [];
    for (const line of raw.slice(0, 16384).split("\n").slice(1, 41)) {
        const match = line.match(/(https?:\/\/[^\s()]+):(\d+):(\d+)\)?$/);
        if (!match)
            continue;
        try {
            const url = new URL(match[1]);
            if (url.username || url.password)
                continue;
            const basename = url.pathname.split("/").at(-1) ?? "";
            const file = /^(?:main|page|chunk|webpack|framework)\.js$/.test(basename)
                ? "/" + basename
                : "/<script>";
            const row = Number(match[2]), column = Number(match[3]);
            if (Number.isSafeInteger(row) &&
                Number.isSafeInteger(column) &&
                row > 0 &&
                column > 0 &&
                row <= 10_000_000 &&
                column <= 10_000_000)
                frames.push({ file, line: row, column });
            if (frames.length === 10)
                break;
        }
        catch {
            /* Drop unsafe locations. */
        }
    }
    return frames;
}
export function sanitizeDiagnostic(source, value, fallbackMessage, filename) {
    // V8 can invoke Error.prepareStackTrace even during descriptor lookup of lazy stack.
    // Do not inspect stack at all if an application formatter/accessor is installed.
    let stackSafe = true;
    try {
        for (let owner = Error; owner; owner = Object.getPrototypeOf(owner)) {
            const formatter = Object.getOwnPropertyDescriptor(owner, "prepareStackTrace");
            if (formatter) {
                stackSafe = Object.hasOwn(formatter, "value") && formatter.value === undefined;
                break;
            }
        }
    }
    catch {
        stackSafe = false;
    }
    const rawStack = stackSafe ? data(value, "stack") : undefined;
    if ((typeof filename === "string" && extensionSource(filename)) ||
        (typeof rawStack === "string" && extensionSource(rawStack.slice(0, 16384))))
        return undefined;
    const rawMessage = data(value, "message");
    // Custom names and inherited accessors are deliberately not inspected.
    let name = "Error";
    try {
        const prototype = value && typeof value === "object"
            ? Object.getPrototypeOf(value)
            : undefined;
        const constructors = [
            Error,
            TypeError,
            ReferenceError,
            SyntaxError,
            RangeError,
            URIError,
            EvalError,
            AggregateError,
        ];
        const index = constructors.findIndex((ctor) => prototype === ctor.prototype);
        if (index >= 0)
            name = ERROR_NAMES[index];
    }
    catch { }
    const ownName = data(value, "name");
    if (typeof ownName === "string" &&
        ERROR_NAMES.includes(ownName))
        name = ownName;
    else if (typeof rawStack === "string") {
        const prefix = rawStack.slice(0, 32).match(/^([A-Za-z]+):/);
        if (prefix && ERROR_NAMES.includes(prefix[1]))
            name = prefix[1];
    }
    const result = {
        source,
        name,
        message: safeMessage(rawMessage ?? fallbackMessage, source),
        frames: sanitizeFrames(rawStack),
    };
    return { ...result, fingerprint: diagnosticFingerprint(result) };
}
