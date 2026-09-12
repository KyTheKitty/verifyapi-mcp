#!/usr/bin/env node
// VerifyAPI MCP server (stdio transport).
//
// One tool: verify_claim.
// If VERIFYAPI_API_KEY is set, calls go to POST /v1/verify (billed).
// If not, calls go to POST /v1/verify/trial (free trial, 3 calls per IP per 24h,
// cached-only, signed receipts still included).

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "node:crypto";

const PKG_VERSION = "0.1.9";
const API_KEY = process.env.VERIFYAPI_API_KEY?.trim() || undefined;
const BASE_URL =
  process.env.VERIFYAPI_BASE_URL?.replace(/\/$/, "") ?? "https://api.verify-api.dev";
const DEFAULT_TIMEOUT_MS = 20_000;
const TRIAL_MODE = !API_KEY;

if (TRIAL_MODE) {
  process.stderr.write(
    "verifyapi-mcp: FREE TRIAL mode (3 calls / 24h, cached-only). " +
      "Get a free API key with no card at https://verify-api.dev/signup to remove limits.\n",
  );
}

const TOOLS = [
  {
    name: "verify_claim",
    description:
      "Fact-check a single factual claim against live web sources. Returns one of `supported`, `refuted`, `insufficient_evidence`, or `out_of_scope`, with confidence, source_url, published_date, and a verbatim exact_quote from that source. Every response is signed with an Ed25519 receipt (verifiable at https://api.verify-api.dev/.well-known/jwks.json).\n\nPricing (see /v1/pricing): $0.02 base per supported/refuted verdict; recent tier (<24h old cache) 2x; fresh tier (cache bypassed, guaranteed live) 5x. insufficient_evidence, out_of_scope, malformed, and cache hits within your account are free. Use `freshness=\"cached\"` (default) for maximum savings; `freshness=\"fresh\"` when you need a guaranteed-current answer (breaking news, live standings, latest release); set `max_age_seconds` for HTTP Cache-Control-style bounded staleness.\n\nRunning without an API key uses the FREE TRIAL (3 calls per IP per 24h, cached tier only, still returns signed receipts). Set VERIFYAPI_API_KEY in the mcpServers env block to remove the limit and unlock the recent/fresh tiers. Get a key at https://verify-api.dev/signup (no credit card).\n\nUse this before committing to any factual claim you are not sure about \u2014 dates, statistics, prices, attributions, event outcomes.",
    inputSchema: {
      type: "object",
      properties: {
        claim: {
          type: "string",
          description:
            "A single factual claim, ideally under 300 characters. If you have multiple claims, call verify_claim once per claim.",
        },
        as_of: {
          type: "string",
          description:
            "Optional ISO date (YYYY-MM-DD). Use for time-sensitive facts, e.g. prices or standings.",
        },
        max_wait_ms: {
          type: "number",
          description:
            "Optional soft deadline in milliseconds. Default 15000. If the pipeline cannot finish in time you'll get insufficient_evidence.",
        },
        freshness: {
          type: "string",
          enum: ["fresh", "cached"],
          description:
            "Optional freshness tier. `fresh` bypasses both caches and runs the full pipeline (5x price) \u2014 use when you need a guaranteed-current answer (breaking news, live standings, latest release version). `cached` (default) honors both cache tiers. See GET /v1/pricing for exact multipliers. (Ignored in trial mode \u2014 trial is cached-only.)",
        },
        max_age_seconds: {
          type: "number",
          minimum: 0,
          maximum: 31536000,
          description:
            "Optional maximum age (in seconds) for a cached verdict. Acts like HTTP Cache-Control: max-age. Values below 3600 trigger the `fresh` tier; below 86400 trigger the `recent` tier (2x price). If both `freshness` and `max_age_seconds` are set, `freshness` wins. (Ignored in trial mode.)",
        },
      },
      required: ["claim"],
      additionalProperties: false,
    },
  },
];

const server = new Server(
  { name: "verifyapi-mcp", version: PKG_VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name !== "verify_claim") {
    return {
      isError: true,
      content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }],
    };
  }

  const args = (req.params.arguments ?? {}) as {
    claim?: unknown;
    as_of?: unknown;
    max_wait_ms?: unknown;
    freshness?: unknown;
    max_age_seconds?: unknown;
  };
  const claim = typeof args.claim === "string" ? args.claim.trim() : "";
  if (!claim) {
    return {
      isError: true,
      content: [{ type: "text", text: "verify_claim requires a non-empty `claim` string." }],
    };
  }

  const body: Record<string, unknown> = { claim };
  if (typeof args.as_of === "string" && args.as_of.length > 0) body.as_of = args.as_of;
  if (typeof args.max_wait_ms === "number" && args.max_wait_ms > 0)
    body.max_wait_ms = Math.min(args.max_wait_ms, 30_000);
  // freshness / max_age only meaningful when authed
  if (!TRIAL_MODE) {
    if (args.freshness === "fresh" || args.freshness === "cached") body.freshness = args.freshness;
    if (
      typeof args.max_age_seconds === "number" &&
      args.max_age_seconds >= 0 &&
      args.max_age_seconds <= 31_536_000
    ) {
      body.max_age_seconds = Math.floor(args.max_age_seconds);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    (Number(body.max_wait_ms) || DEFAULT_TIMEOUT_MS) + 5_000,
  );

  // Route: authed → /v1/verify with Bearer; trial → /v1/verify/trial with no auth
  const endpoint = TRIAL_MODE ? "/v1/verify/trial" : "/v1/verify";
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "idempotency-key": randomUUID(),
    "user-agent": `verifyapi-mcp/${PKG_VERSION}`,
  };
  if (!TRIAL_MODE) headers.authorization = `Bearer ${API_KEY}`;

  try {
    const resp = await fetch(`${BASE_URL}${endpoint}`, {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify(body),
    });

    const text = await resp.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    if (!resp.ok) {
      // Trial rate-limited: give a helpful nudge
      if (TRIAL_MODE && (resp.status === 429 || resp.status === 402)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text:
                `Free trial limit reached (${resp.status}, 3 calls / 24h per IP). ` +
                `Get an API key at https://verify-api.dev/signup — no credit card, ` +
                `then set VERIFYAPI_API_KEY in your mcpServers env block.`,
            },
          ],
        };
      }
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `verifyapi ${resp.status}: ${JSON.stringify(parsed)}`,
          },
        ],
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(parsed, null, 2) }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [{ type: "text", text: `verifyapi request failed: ${msg}` }],
    };
  } finally {
    clearTimeout(timeout);
  }
});

await server.connect(new StdioServerTransport());
