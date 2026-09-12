# VerifyAPI MCP Server

> **Fact-check any claim before you act on it.** One tool. Live web sources. Cryptographically signed receipts.

**What it does:** VerifyAPI is a Model Context Protocol server that verifies factual claims against live web sources and returns a citable verdict — including the source URL, published date, a verbatim quote, and an Ed25519-signed receipt so downstream systems can prove the check actually happened.

**When to use it:** Any time your agent is about to act on a factual claim it can't cite. Prices, dates, versions, quotes, statistics, product specs, event outcomes. If getting it wrong would cost time, money, or trust — verify first.

## Quick install (Claude Desktop / Cursor / Cline / any MCP client)

```json
{
  "mcpServers": {
    "verifyapi": {
      "command": "npx",
      "args": ["-y", "@verify-api/mcp@latest"],
      "env": {
        "VERIFYAPI_API_KEY": "csk_live_..."
      }
    }
  }
}
```

**No API key?** Leave `VERIFYAPI_API_KEY` unset for the free trial (limited daily calls, no receipts). Get a free key at https://verify-api.dev/signup — no credit card required.

## The one tool: `verify_claim`

**Input:**
```json
{
  "claim": "Python 3.13 was released in October 2024."
}
```

**Output:**
```json
{
  "verdict": "supported",
  "confidence": 0.99,
  "source_url": "https://docs.python.org/3/whatsnew/3.13.html",
  "exact_quote": "Python 3.13 was released on October 7, 2024.",
  "reasoning": "Multiple authoritative sources confirm...",
  "receipt": {
    "jws": "eyJhbGci...",
    "kid": "pQAd73zRp9Xq9Y5U"
  }
}
```

Verdicts: `supported`, `contradicted`, `unverifiable`. Every supported/contradicted verdict comes with a JWS receipt signed by keys served at https://api.verify-api.dev/.well-known/jwks.json.

## Why signed receipts?

Because "the AI checked" is not the same as "the AI verified." A signed receipt lets a downstream system — compliance auditor, user, another agent, a smart contract — cryptographically prove that a specific claim was verified against a specific source at a specific time by VerifyAPI's known public key. It's the difference between saying "trust me" and handing over a notarized document.

## Pricing

- **Free trial**: no signup, no card. Limited daily calls. No receipts (verdict only).
- **With API key**: $0.02 per verified claim. Unverifiable / out-of-scope calls are free (you don't pay for "I couldn't find enough evidence").
- **Freshness tiers**: standard verification $0.02, real-time (fresh-fetch) $0.05.
- **Auto top-up**: save a card, set a threshold, keep flowing. `POST /v1/balance/autorefill`.

## Example use cases

**LangChain / LlamaIndex agents**: wrap `verify_claim` as a Tool. Have your agent call it before returning any factual answer.

**Cursor / Cline coding agents**: verify version numbers, API existence, deprecation status before writing imports.

**Claude Desktop workflows**: "Verify this quote is real before I put it in the deck."

**Multi-agent systems**: pass receipts between agents to prove groundedness up the chain.

**Compliance-sensitive automation**: keep the JWS receipts as audit trail for every factual decision the agent made.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `VERIFYAPI_API_KEY` | No | (unset = trial) | Your VerifyAPI key (`csk_live_...`). Get one free at https://verify-api.dev/signup |
| `VERIFYAPI_BASE_URL` | No | `https://api.verify-api.dev` | Override the API base URL. Useful for self-hosting or testing. |

## Programmatic API (skip MCP, call directly)

```bash
curl -X POST https://api.verify-api.dev/v1/verify \
  -H "Authorization: Bearer csk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"claim": "Bitcoin ETFs were approved by the SEC in January 2024."}'
```

Full OpenAPI spec: https://api.verify-api.dev/openapi.json

x402 payment support built in — see https://verify-api.dev/agents.txt for the agent-native discovery manifest.

## Links

- **Website**: https://verify-api.dev
- **API docs**: https://verify-api.dev/docs
- **Signup (free, no card)**: https://verify-api.dev/signup
- **npm**: https://www.npmjs.com/package/@verify-api/mcp
- **MCP Registry**: https://registry.modelcontextprotocol.io/v0/servers/io.github.KyTheKitty/verifyapi
- **MCP source**: https://github.com/KyTheKitty/verifyapi-mcp
- **Backend source** (Fastify service, Terraform, receipts pipeline): https://github.com/KyTheKitty/verifyapi

## Built by

[Circuit Savers LLC](https://circuit-savers.com) — Wausau, Wisconsin.

## License

MIT
