import assert from "node:assert/strict";
import test from "node:test";
import { backendBaseUrl, forwardRequest, sameOriginWrite, validateBridgePath } from "../src/lib/api-bridge.ts";

test("allowlisted tenant paths only", () => {
  assert.equal(validateBridgePath("GET", ["v1", "organizations", "2", "tickets"]), "/v1/organizations/2/tickets");
  assert.equal(validateBridgePath("GET", ["v1", "organizations", "2", "me"]), "/v1/organizations/2/me");
  assert.equal(validateBridgePath("DELETE", ["v1", "organizations", "2", "tickets", "1"]), null);
  assert.equal(validateBridgePath("GET", ["v1", "predict"]), null);
  assert.equal(validateBridgePath("GET", ["v1", "organizations", "2", "..", "tickets"]), null);
  assert.equal(validateBridgePath("GET", ["v1", "organizations", "0", "tickets"]), null);
});

test("origin and backend URL protections", () => {
  assert.equal(sameOriginWrite("https://copilot.example/api", "POST", "https://evil.example"), false);
  assert.equal(sameOriginWrite("https://copilot.example/api", "POST", null), false);
  assert.equal(sameOriginWrite("https://copilot.example/api", "POST", "https://copilot.example"), true);
  assert.equal(backendBaseUrl("https://user:password@api.example/"), null);
  assert.equal(backendBaseUrl("file:///etc/passwd"), null);
});

test("without bearer token, never contact API", async () => {
  let called = false;
  const response = await forwardRequest({
    request: new Request("https://copilot.example/api/copilot/v1/organizations/1/tickets"),
    segments: ["v1", "organizations", "1", "tickets"],
    accessToken: null, expiresAt: null, baseUrl: "https://api.example",
    fetcher: async () => { called = true; return new Response("leak"); },
  });
  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test("proxy forwards only server bearer, restricts query and rejects redirects", async () => {
  let destination = "";
  let bearer = "";
  const response = await forwardRequest({
    request: new Request("https://copilot.example/api/copilot/v1/organizations/4/knowledge/search?q=VPN&admin=1"),
    segments: ["v1", "organizations", "4", "knowledge", "search"],
    accessToken: "server-token", expiresAt: Date.now() + 60_000,
    baseUrl: "https://api.example",
    fetcher: async (url, options) => {
      destination = String(url);
      bearer = String(new Headers(options?.headers).get("authorization"));
      return Response.json([{ source: "vpn.md" }]);
    },
  });
  assert.equal(response.status, 200);
  assert.equal(destination, "https://api.example/v1/organizations/4/knowledge/search?q=VPN");
  assert.equal(bearer, "Bearer server-token");
});

test("block cross-site modifications and oversized payloads", async () => {
  const response = await forwardRequest({
    request: new Request("https://copilot.example/api/copilot/v1/organizations/4/tickets", {
      method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" },
      body: JSON.stringify({ title: "x", description: "y" }),
    }),
    segments: ["v1", "organizations", "4", "tickets"],
    accessToken: "server-token", expiresAt: Date.now() + 60_000, baseUrl: "https://api.example",
  });
  assert.equal(response.status, 403);
});
