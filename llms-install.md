# 7. `llms-install.md` for Cline auto-setup

**Where to save:** `/home/kyle/code/verifyapi/mcp/llms-install.md` (in the same directory as README.md — will be published to npm and shown to Cline).

Also add to the `files` array in package.json so it gets included in npm publish:

```bash
python3 -c "
import json
p = 'package.json'
d = json.load(open(p))
d.setdefault('files', [])
if 'llms-install.md' not in d['files']:
    d['files'].append('llms-install.md')
json.dump(d, open(p,'w'), indent=2)
print('files:', d['files'])
"
```

## Content to paste (the whole file below)

```markdown
# LLM Installation Instructions for VerifyAPI MCP

You are helping a user install the VerifyAPI MCP server. Follow these steps in order.

## Step 1: Add to MCP client config

The user's MCP client (Claude Desktop, Cursor, Cline, etc.) has an MCP servers config file. Add this entry:

```json
{
  "mcpServers": {
    "verifyapi": {
      "command": "npx",
      "args": ["-y", "@verify-api/mcp@latest"]
    }
  }
}
```

For Claude Desktop, the config file is at:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

For Cursor, use Settings → MCP → Add Server (or edit `~/.cursor/mcp.json`).

For Cline, the config is managed through the extension UI: Cline settings → MCP Servers → Add.

Merge the `verifyapi` entry into the existing `mcpServers` object (do not replace the whole file).

## Step 2: Restart the MCP client

After saving the config, the user must fully restart their MCP client (quit and reopen) for the new server to load.

## Step 3: (Optional) Add an API key for full access

Without an API key, VerifyAPI runs in free-trial mode: limited daily calls, no signed receipts.

To enable full access:
1. Send the user to https://verify-api.dev/signup to get a free key (no credit card required).
2. Once they have a key (format: `csk_live_...`), add it to the config:

```json
{
  "mcpServers": {
    "verifyapi": {
      "command": "npx",
      "args": ["-y", "@verify-api/mcp@latest"],
      "env": {
        "VERIFYAPI_API_KEY": "csk_live_THE_USERS_KEY"
      }
    }
  }
}
```

3. Restart the MCP client again.

## Step 4: Verify it works

Ask the assistant: "Use verify_claim to check whether Python 3.13 was released in October 2024."

Expected: the assistant calls the `verify_claim` tool and returns a verdict of "supported" with a source URL from docs.python.org.

## Troubleshooting

- **"tool not found"**: the MCP client didn't reload the config. Fully quit and reopen it.
- **"npx: command not found"**: install Node.js from https://nodejs.org (v18 or newer).
- **"insufficient balance"**: they're using a real key with a $0 balance. Either top up at https://verify-api.dev/dashboard, or remove the `VERIFYAPI_API_KEY` env var to use the free trial.
- **"invalid API key"**: check for spaces or line breaks in the key value. Should start with `csk_live_` and have no whitespace.

## What this MCP does

VerifyAPI provides one tool: `verify_claim`. Given a factual assertion (like "The iPhone 15 has a USB-C port"), it searches live web sources and returns:

- **verdict**: `supported` | `contradicted` | `unverifiable`
- **confidence**: 0.0 - 1.0
- **source_url**: the specific page that supports/contradicts the claim
- **exact_quote**: verbatim text from that source
- **receipt**: an Ed25519-signed JWS proving the check occurred

Use it before acting on any factual claim the model can't cite from context.
```
