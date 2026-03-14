// ============================================================================
// CUSTOM FETCH - Unified API Client Foundation
// ============================================================================
// This module provides a fetch wrapper with consistent error handling,
// response parsing, and cross-runtime compatibility (browser + React Native).
//
// WHY THIS EXISTS:
// All generated React Query hooks use this as their fetch implementation.
// By centralizing fetch logic here:
// 1. Error handling is consistent across all endpoints
// 2. Response parsing heuristics are reusable
// 3. Runtime compatibility (browser/RN) is handled once
// 4. Debugging can be added in one place (see console.log statements below)
//
// KEY FEATURES:
// - Automatic Content-Type detection and header defaults
// - Smart response parsing (JSON/text/blob based on Content-Type)
// - Rich error objects with full response context
// - BOM stripping for edge-case JSON parsing
// - React Native compatibility (no ReadableStream dependency)
//
// USAGE:
// This is used internally by generated code in src/generated/api.ts.
// You typically don't call customFetch() directly; use the generated hooks instead.
// Example: useHealthCheck() -> healthCheck() -> customFetch("/api/healthz")
//
// FUTURE MARITIME DATA INTEGRATION:
// When FleetCommand consumes real APIs (telemetry, mission data, etc.):
// 1. Define endpoints in lib/api-spec/openapi.yaml
// 2. Run codegen: pnpm --filter @workspace/api-spec run codegen
// 3. Generated hooks will automatically use this fetch wrapper
// 4. All logging and error handling here will apply to maritime data requests
// ============================================================================

console.log("[custom-fetch] Module loaded");

// Extended fetch options with responseType hint
export type CustomFetchOptions = RequestInit & {
  responseType?: "json" | "text" | "blob" | "auto"; // "auto" infers from Content-Type
};

// Type aliases for generated code compatibility
export type ErrorType<T = unknown> = ApiError<T>;
export type BodyType<T> = T;

// HTTP status codes that never have a response body
const NO_BODY_STATUS = new Set([204, 205, 304]); // No Content, Reset Content, Not Modified

// Default Accept header for JSON requests
const DEFAULT_JSON_ACCEPT = "application/json, application/problem+json";

console.log("[custom-fetch] Constants initialized:", {
  noBodyStatuses: Array.from(NO_BODY_STATUS),
  defaultJsonAccept: DEFAULT_JSON_ACCEPT,
});

// ─── Type Guards and Utilities ──────────────────────────────────────────────
// Helper functions for runtime type checking and value extraction

// Check if input is a Request object (vs string URL or URL object)
function isRequest(input: RequestInfo | URL): input is Request {
  return typeof Request !== "undefined" && input instanceof Request;
}

// Extract HTTP method from input
// Priority: explicit method option > Request.method > default "GET"
function resolveMethod(input: RequestInfo | URL, explicitMethod?: string): string {
  if (explicitMethod) return explicitMethod.toUpperCase();
  if (isRequest(input)) return input.method.toUpperCase();
  return "GET";
}

// Check if input is a URL object
// Uses loose check for React Native compatibility (RN polyfills URL differently)
function isUrl(input: RequestInfo | URL): input is URL {
  return typeof URL !== "undefined" && input instanceof URL;
}

// Extract URL string from input (handles string | URL | Request)
function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (isUrl(input)) return input.toString();
  return input.url; // Request.url
}

// Merge multiple HeadersInit sources into a single Headers object
// Later sources override earlier sources (last write wins)
function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers();

  for (const source of sources) {
    if (!source) continue;
    new Headers(source).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

// Extract media type from Content-Type header
// Returns only the type/subtype, stripping charset and other parameters
// Example: "application/json; charset=utf-8" -> "application/json"
function getMediaType(headers: Headers): string | null {
  const value = headers.get("content-type");
  return value ? value.split(";", 1)[0].trim().toLowerCase() : null;
}

// Check if media type is JSON (application/json or anything ending with +json)
// Examples: application/json, application/problem+json, application/vnd.api+json
function isJsonMediaType(mediaType: string | null): boolean {
  return mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"));
}

// Check if media type is text-like (text/*, xml variants, form-urlencoded)
function isTextMediaType(mediaType: string | null): boolean {
  return Boolean(
    mediaType &&
      (mediaType.startsWith("text/") ||
        mediaType === "application/xml" ||
        mediaType === "text/xml" ||
        mediaType.endsWith("+xml") ||
        mediaType === "application/x-www-form-urlencoded"),
  );
}

// Check if response should have no body
// Handles browser (body=null) and React Native (body=undefined) differently
// Uses loose equality (== null) to catch both null and undefined
function hasNoBody(response: Response, method: string): boolean {
  if (method === "HEAD") return true;                           // HEAD never has body
  if (NO_BODY_STATUS.has(response.status)) return true;         // 204, 205, 304 have no body
  if (response.headers.get("content-length") === "0") return true; // Explicit zero length
  if (response.body == null) return true;                       // null (browser) or undefined (RN)
  return false;
}

// Strip UTF-8 BOM (byte order mark) from start of text
// Some servers incorrectly include BOM in JSON responses, breaking JSON.parse()
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

// Heuristic: does this text look like JSON?
// Used as fallback when Content-Type header is missing/wrong
function looksLikeJson(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

// Extract a string field from an unknown object (safe accessor)
// Returns undefined if value is not an object, field doesn't exist,
// field is not a string, or field is empty after trimming
function getStringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;

  const candidate = (value as Record<string, unknown>)[key];
  if (typeof candidate !== "string") return undefined;

  const trimmed = candidate.trim();
  return trimmed === "" ? undefined : trimmed;
}

// Truncate long text for error messages (prevents giant error logs)
function truncate(text: string, maxLength = 300): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

// Build human-readable error message from HTTP error response
// Tries multiple common error response formats (RFC 7807, generic message/error fields)
function buildErrorMessage(response: Response, data: unknown): string {
  const prefix = `HTTP ${response.status} ${response.statusText}`;

  // String error body: use it directly (truncated)
  if (typeof data === "string") {
    const text = data.trim();
    return text ? `${prefix}: ${truncate(text)}` : prefix;
  }

  // Try to extract structured error fields
  // Supports: RFC 7807 (title/detail), generic (message/error/error_description)
  const title = getStringField(data, "title");
  const detail = getStringField(data, "detail");
  const message =
    getStringField(data, "message") ??
    getStringField(data, "error_description") ??
    getStringField(data, "error");

  if (title && detail) return `${prefix}: ${title} — ${detail}`;
  if (detail) return `${prefix}: ${detail}`;
  if (message) return `${prefix}: ${message}`;
  if (title) return `${prefix}: ${title}`;

  return prefix;
}

// ─── Error Classes ──────────────────────────────────────────────────────────
// Custom error types for different failure modes

// ============================================================================
// API ERROR - HTTP Error Response (4xx, 5xx)
// ============================================================================
// Thrown when the server returns an error status code (response.ok === false)
// Captures full response context for debugging and error handling
//
// PROPERTIES:
// - status: HTTP status code (e.g. 404, 500)
// - statusText: Status message (e.g. "Not Found")
// - data: Parsed error response body (type-safe when using generated hooks)
// - headers: Response headers
// - response: Raw Response object
// - method: Request method
// - url: Request URL
//
// USAGE:
// try {
//   await customFetch("/api/endpoint");
// } catch (err) {
//   if (err instanceof ApiError) {
//     console.log("HTTP error:", err.status, err.data);
//   }
// }
// ============================================================================
export class ApiError<T = unknown> extends Error {
  readonly name = "ApiError";
  readonly status: number;
  readonly statusText: string;
  readonly data: T | null;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;

  constructor(
    response: Response,
    data: T | null,
    requestInfo: { method: string; url: string },
  ) {
    super(buildErrorMessage(response, data));
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.data = data;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
    
    console.error("[ApiError] HTTP error response:", {
      method: this.method,
      url: this.url,
      status: this.status,
      statusText: this.statusText,
      data: this.data,
    });
  }
}

// ============================================================================
// RESPONSE PARSE ERROR - JSON Parsing Failure
// ============================================================================
// Thrown when response.ok === true but the body can't be parsed as JSON
// This is distinct from ApiError because the HTTP request succeeded,
// but the response body is malformed or unexpected.
//
// PROPERTIES:
// - status: HTTP status code (typically 200)
// - rawBody: The unparseable response text (for inspection)
// - cause: The original JSON.parse() error
//
// COMMON CAUSES:
// - Server returned HTML instead of JSON (routing error)
// - Malformed JSON syntax
// - Empty response when JSON expected
// - BOM or encoding issues (stripBom should handle this, but edge cases exist)
//
// DEBUGGING:
// Check rawBody property to see what the server actually returned
// ============================================================================
export class ResponseParseError extends Error {
  readonly name = "ResponseParseError";
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;
  readonly rawBody: string;
  readonly cause: unknown;

  constructor(
    response: Response,
    rawBody: string,
    cause: unknown,
    requestInfo: { method: string; url: string },
  ) {
    super(
      `Failed to parse response from ${requestInfo.method} ${response.url || requestInfo.url} ` +
        `(${response.status} ${response.statusText}) as JSON`,
    );
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
    this.rawBody = rawBody;
    this.cause = cause;
    
    console.error("[ResponseParseError] Failed to parse JSON response:", {
      method: this.method,
      url: this.url,
      status: this.status,
      rawBodyPreview: rawBody.substring(0, 200) + (rawBody.length > 200 ? "..." : ""),
      cause,
    });
  }
}

// ─── Response Parsing Functions ─────────────────────────────────────────────
// These functions handle the complex task of parsing HTTP response bodies
// across different content types and runtimes

// ============================================================================
// Parse JSON Body - Success Path
// ============================================================================
// Parses response body as JSON, with BOM stripping and error handling
// Throws ResponseParseError if JSON.parse() fails
async function parseJsonBody(
  response: Response,
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  console.log("[parseJsonBody] Parsing JSON response for:", requestInfo.method, requestInfo.url);
  
  // Read body as text first (allows BOM stripping and inspection on error)
  const raw = await response.text();
  console.log("[parseJsonBody] Raw body length:", raw.length, "characters");
  
  // Strip BOM if present (some servers incorrectly include it)
  const normalized = stripBom(raw);
  if (normalized !== raw) {
    console.log("[parseJsonBody] BOM detected and stripped");
  }

  // Empty body -> null (not an error for JSON responses)
  if (normalized.trim() === "") {
    console.log("[parseJsonBody] Empty body, returning null");
    return null;
  }

  try {
    const parsed = JSON.parse(normalized);
    console.log("[parseJsonBody] ✓ JSON parsed successfully");
    return parsed;
  } catch (cause) {
    console.error("[parseJsonBody] ✗ JSON parse failed");
    console.error("[parseJsonBody] Body preview:", raw.substring(0, 200));
    throw new ResponseParseError(response, raw, cause, requestInfo);
  }
}

// ============================================================================
// Parse Error Body - Error Path
// ============================================================================
// Parses response body when response.ok === false (4xx, 5xx)
// More lenient than parseJsonBody - attempts JSON but falls back to text/blob
// Never throws (errors during error parsing would hide the original error)
async function parseErrorBody(response: Response, method: string): Promise<unknown> {
  console.log("[parseErrorBody] Parsing error response body");
  
  if (hasNoBody(response, method)) {
    console.log("[parseErrorBody] Response has no body (HEAD, 204, etc.)");
    return null;
  }

  const mediaType = getMediaType(response.headers);
  console.log("[parseErrorBody] Content-Type:", mediaType ?? "(none)");

  // Non-text, non-JSON media type: return as blob if supported, else text
  if (mediaType && !isJsonMediaType(mediaType) && !isTextMediaType(mediaType)) {
    console.log("[parseErrorBody] Binary/blob response detected");
    return typeof response.blob === "function" ? response.blob() : response.text();
  }

  const raw = await response.text();
  const normalized = stripBom(raw);
  const trimmed = normalized.trim();
  
  console.log("[parseErrorBody] Body length:", raw.length, "characters");

  if (trimmed === "") {
    console.log("[parseErrorBody] Empty body");
    return null;
  }

  // Try to parse as JSON (header says JSON OR body looks like JSON)
  if (isJsonMediaType(mediaType) || looksLikeJson(normalized)) {
    console.log("[parseErrorBody] Attempting JSON parse");
    try {
      const parsed = JSON.parse(normalized);
      console.log("[parseErrorBody] ✓ Error body parsed as JSON");
      return parsed;
    } catch (err) {
      console.warn("[parseErrorBody] JSON parse failed, returning raw text");
      return raw;
    }
  }

  console.log("[parseErrorBody] Returning as plain text");
  return raw;
}

// ============================================================================
// Infer Response Type - Auto Mode
// ============================================================================
// When responseType="auto", infer the best parse mode from Content-Type header
function inferResponseType(response: Response): "json" | "text" | "blob" {
  const mediaType = getMediaType(response.headers);

  if (isJsonMediaType(mediaType)) return "json";
  if (isTextMediaType(mediaType) || mediaType == null) return "text";
  return "blob";
}

// ============================================================================
// Parse Success Body - Success Path
// ============================================================================
// Parses response body when response.ok === true
// Delegates to appropriate parser based on responseType
async function parseSuccessBody(
  response: Response,
  responseType: "json" | "text" | "blob" | "auto",
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  console.log("[parseSuccessBody] Parsing success response");
  console.log("[parseSuccessBody] Response type:", responseType);
  
  if (hasNoBody(response, requestInfo.method)) {
    console.log("[parseSuccessBody] Response has no body");
    return null;
  }

  // Resolve "auto" to concrete type
  const effectiveType =
    responseType === "auto" ? inferResponseType(response) : responseType;
  console.log("[parseSuccessBody] Effective type:", effectiveType);

  switch (effectiveType) {
    case "json":
      return parseJsonBody(response, requestInfo);

    case "text": {
      const text = await response.text();
      console.log("[parseSuccessBody] Text response length:", text.length);
      return text === "" ? null : text;
    }

    case "blob":
      if (typeof response.blob !== "function") {
        console.error("[parseSuccessBody] ✗ Blob not supported in this runtime");
        throw new TypeError(
          "Blob responses are not supported in this runtime. " +
            "Use responseType \"json\" or \"text\" instead.",
        );
      }
      console.log("[parseSuccessBody] Returning blob response");
      return response.blob();
  }
}

// ============================================================================
// CUSTOM FETCH - Main Fetch Wrapper
// ============================================================================
// The core fetch function used by all generated API hooks.
// This is the single point of integration for all API requests in FleetCommand.
//
// FLOW:
// 1. Extract and validate options
// 2. Resolve HTTP method (from input or options)
// 3. Validate method/body combination (GET/HEAD can't have body)
// 4. Merge headers (Request headers + options headers)
// 5. Auto-detect Content-Type if body looks like JSON
// 6. Set Accept header for JSON requests
// 7. Execute fetch()
// 8. Check response.ok
// 9. If error (response.ok=false): parse error body -> throw ApiError
// 10. If success (response.ok=true): parse success body -> return typed result
//
// DEBUGGING:
// All requests and responses are logged here, making this the best place
// to diagnose API issues, inspect payloads, and understand request flow.
//
// FUTURE MARITIME DATA:
// When FleetCommand consumes real telemetry/mission APIs:
// - All requests flow through this function
// - All logging here applies automatically
// - Error handling is consistent across all endpoints
// - No per-endpoint debugging code needed
// ============================================================================
export async function customFetch<T = unknown>(
  input: RequestInfo | URL,
  options: CustomFetchOptions = {},
): Promise<T> {
  const { responseType = "auto", headers: headersInit, ...init } = options;

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("[customFetch] Starting request");
  
  // Resolve method from input/options
  const method = resolveMethod(input, init.method);
  const url = resolveUrl(input);
  console.log("[customFetch] Method:", method);
  console.log("[customFetch] URL:", url);
  console.log("[customFetch] Response type:", responseType);

  // Validate method/body combination
  if (init.body != null && (method === "GET" || method === "HEAD")) {
    console.error("[customFetch] ✗ Invalid: GET/HEAD requests cannot have a body");
    throw new TypeError(`customFetch: ${method} requests cannot have a body.`);
  }

  // Merge headers from Request object and options
  const headers = mergeHeaders(isRequest(input) ? input.headers : undefined, headersInit);
  console.log("[customFetch] Headers:", Array.from(headers.entries()));

  // Auto-detect Content-Type for JSON request bodies
  if (
    typeof init.body === "string" &&
    !headers.has("content-type") &&
    looksLikeJson(init.body)
  ) {
    console.log("[customFetch] Body looks like JSON, setting Content-Type: application/json");
    headers.set("content-type", "application/json");
  }

  // Set Accept header for JSON requests (if not already set)
  if (responseType === "json" && !headers.has("accept")) {
    console.log("[customFetch] Setting Accept header for JSON response");
    headers.set("accept", DEFAULT_JSON_ACCEPT);
  }

  const requestInfo = { method, url };

  // Execute fetch
  console.log("[customFetch] Executing fetch()");
  const response = await fetch(input, { ...init, method, headers });
  console.log("[customFetch] Response received:");
  console.log("[customFetch]   Status:", response.status, response.statusText);
  console.log("[customFetch]   OK:", response.ok);
  console.log("[customFetch]   Content-Type:", getMediaType(response.headers) ?? "(none)");

  // Handle error responses (4xx, 5xx)
  if (!response.ok) {
    console.error("[customFetch] ✗ Response not OK, parsing error body");
    const errorData = await parseErrorBody(response, method);
    throw new ApiError(response, errorData, requestInfo);
  }

  // Handle success responses (2xx, 3xx)
  console.log("[customFetch] ✓ Response OK, parsing success body");
  const result = await parseSuccessBody(response, responseType, requestInfo);
  console.log("[customFetch] ✓ Request completed successfully");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  return result as T;
}
