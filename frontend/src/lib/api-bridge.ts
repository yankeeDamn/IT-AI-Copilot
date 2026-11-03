/** Server-only API boundary: route allowlist, same-origin writes and bearer forwarding. */
export type BridgeMethod = "GET" | "POST" | "PATCH";
type HttpClient = (input: string | URL, init?: RequestInit) => Promise<Response>;

const paths: { method: BridgeMethod; pattern: RegExp }[] = [
  { method: "GET", pattern: /^\/v1\/organizations\/[1-9]\d{0,8}\/me$/ },
  { method: "GET", pattern: /^\/v1\/organizations\/[1-9]\d{0,8}\/tickets$/ },
  { method: "POST", pattern: /^\/v1\/organizations\/[1-9]\d{0,8}\/tickets$/ },
  { method: "GET", pattern: /^\/v1\/organizations\/[1-9]\d{0,8}\/tickets\/\d+$/ },
  { method: "PATCH", pattern: /^\/v1\/organizations\/[1-9]\d{0,8}\/tickets\/\d+$/ },
  { method: "POST", pattern: /^\/v1\/organizations\/[1-9]\d{0,8}\/tickets\/\d+\/(classify|suggest|automations)$/ },
  { method: "GET", pattern: /^\/v1\/organizations\/[1-9]\d{0,8}\/tickets\/\d+\/audit$/ },
  { method: "GET", pattern: /^\/v1\/organizations\/[1-9]\d{0,8}\/dashboard\/summary$/ },
  { method: "GET", pattern: /^\/v1\/organizations\/[1-9]\d{0,8}\/knowledge\/search$/ },
  { method: "POST", pattern: /^\/v1\/organizations\/[1-9]\d{0,8}\/automations\/\d+\/approve$/ },
];

export function validateBridgePath(method: string, segments: string[]): string | null {
  if (!["GET", "POST", "PATCH"].includes(method)) return null;
  if (segments.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part))) return null;
  const path = "/" + segments.join("/");
  return paths.some((p) => p.method === method && p.pattern.test(path)) ? path : null;
}

export function sameOriginWrite(requestUrl: string, method: string, origin: string | null): boolean {
  if (method === "GET") return true;
  if (!origin) return false;
  return origin === new URL(requestUrl).origin;
}

export function backendBaseUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password
        || parsed.search || parsed.hash || parsed.pathname !== "/") return null;
    // API endpoint must be operator-defined; request input never controls its host.
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export async function forwardRequest(args: {
  request: Request;
  segments: string[];
  accessToken: string | null;
  expiresAt: number | null;
  baseUrl: string | undefined;
  fetcher?: HttpClient;
}): Promise<Response> {
  const { request, segments, accessToken, expiresAt, baseUrl } = args;
  const method = request.method;
  const path = validateBridgePath(method, segments);
  if (!path) return Response.json({ error: "Route or method not allowed" }, { status: 404 });
  if (!sameOriginWrite(request.url, method, request.headers.get("origin"))) {
    return Response.json({ error: "Cross-origin write blocked" }, { status: 403 });
  }
  if (!accessToken || !expiresAt || Date.now() >= expiresAt - 10_000) {
    return Response.json({ error: "Session expired; sign in again" }, { status: 401 });
  }
  const base = backendBaseUrl(baseUrl);
  if (!base) return Response.json({ error: "Backend is not configured" }, { status: 503 });
  if (method !== "GET" && !request.headers.get("content-type")?.startsWith("application/json")
      && request.headers.get("content-length") !== "0") {
    return Response.json({ error: "JSON required" }, { status: 415 });
  }
  const raw = method === "GET" ? undefined : await request.text();
  if ((raw?.length ?? 0) > 16_384) {
    return Response.json({ error: "Request too large" }, { status: 413 });
  }
  const query = new URL(request.url).searchParams;
  // Only allow expected knowledge search query, never arbitrary user query params.
  const search = path.endsWith("/knowledge/search") ? new URLSearchParams({ q: (query.get("q") || "").slice(0, 500) }).toString() : "";
  try {
    const response = await (args.fetcher ?? fetch)(base + path + (search ? "?" + search : ""), {
      method,
      headers: { Authorization: "Bearer " + accessToken, Accept: "application/json",
        ...(raw ? { "Content-Type": "application/json" } : {}) },
      body: raw,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      redirect: "manual",
    });
    if (response.status >= 300 && response.status < 400) {
      return Response.json({ error: "Unexpected backend redirect" }, { status: 502 });
    }
    const responseBody = await response.text();
    return new Response(responseBody, {
      status: response.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "Backend unavailable" }, { status: 502 });
  }
}
