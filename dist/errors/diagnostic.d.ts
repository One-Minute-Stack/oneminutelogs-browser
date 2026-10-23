export declare const ERROR_NAMES: readonly ["Error", "TypeError", "ReferenceError", "SyntaxError", "RangeError", "URIError", "EvalError", "AggregateError"];
export declare const ERROR_MESSAGES: readonly ["JavaScript exception", "Unhandled promise rejection", "Cannot read properties of undefined", "Cannot read properties of null", "Value is not a function", "Value is not defined", "Assignment to constant variable", "Maximum call stack size exceeded", "Invalid array length", "Unexpected token", "Invalid URL"];
export interface StackFrame {
    file: string;
    line: number;
    column: number;
}
export interface Diagnostic {
    source: "exception" | "unhandled_rejection";
    name: string;
    message: string;
    frames: StackFrame[];
    fingerprint: string;
}
export declare const extensionSource: (text: string) => boolean;
export declare function diagnosticFingerprint(value: Omit<Diagnostic, "fingerprint">): string;
export declare function safeMessage(raw: unknown, source: Diagnostic["source"]): string;
export declare function sanitizeFrames(raw: unknown): StackFrame[];
export declare function sanitizeDiagnostic(source: Diagnostic["source"], value: unknown, fallbackMessage?: unknown, filename?: unknown): Diagnostic | undefined;
