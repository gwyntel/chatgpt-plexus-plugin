---
name: plexus-admin
description: Configure and administer a user-selected mcowger/Plexus instance, including providers, model aliases, routing, keys, quotas, logs, and MCP server configuration. Use for Plexus Admin setup and administration.
---

# Plexus Admin

## Host and file portability
This skill's primary interface is the ChatGPT Plexus Admin plugin and its MCP tools; those tools, saved-connection status, and connection UI are not provided by the skill itself and are not portable to other agents. In another host, use only a separately configured, authorized Plexus MCP connection or the bundled CLI below. If neither exists, explain the limitation rather than implying an operation succeeded. Resolve `scripts/` and `references/` from this skill's installed directory (the directory containing this `SKILL.md`), not from the agent's current working directory. A host may expose a skill directory variable or file-reading tool; otherwise ask the user to locate the installed skill. Never assume a Hermes path or tool.

## Setup
Use the installed Plexus Admin OAuth tools. Start with plexus_connection_status to check the caller's saved connection. If no connection is configured, direct the user to the private setup URL supplied by the operator (replace the example https://your-site.example.com with the deployed private Site URL before use), and have them sign in with ChatGPT, enter the Plexus base URL and administrator key in that page's password field, and select Verify and save connection. Never ask for the key in chat. Setup uses a browser on mobile or desktop and does not require the ChatGPT desktop app.

Sites authenticates this plugin's MCP connection. The private adapter stores the user's Plexus administrator key encrypted server-side, then forwards tool requests with x-admin-key to the chosen instance. This does not enable native OAuth on Plexus's management endpoint. Do not direct users to the old Plexus Admin or Plexus Admin Connected plugins for setup.

After setup, use plexus_connection_status and then plexus_config with operation status for read-only verification. Use the tools actually available in the current chat. If plugin tools have not loaded after installation, ask for a new chat with Plexus Admin OAuth selected; do not claim that installation proves an authenticated call works. Tool schemas may differ across Plexus versions. The adapter always requests redaction and does not expose the saved key to tools.

## Bundled CLI fallback
When the MCP lacks an operation, the plugin includes a source-pinned adaptation of the upstream CLI. Requires Node.js 24+ in an execution environment. Resolve paths relative to this SKILL.md:

```sh
node --experimental-transform-types scripts/index.ts --help
node --experimental-transform-types scripts/index.ts api list
node --experimental-transform-types scripts/index.ts api describe OPERATION
node --experimental-transform-types scripts/index.ts api call OPERATION --body-file payload.json
```

Set PLEXUS_URL to the intended server base URL and provision PLEXUS_ADMIN_KEY securely in the execution environment. Native MCP connection secrets are not automatically available to this CLI; never extract them. The CLI discovers the server's OpenAPI schema. Use `--param name=value` for path/query parameters. Use `--output json` for structured output. Read references/operations.md for upstream operation guidance. Ignore its checkout-local invocation examples; use the bundled command above. Do not use its local development password for a remote instance.

## Administration
Inspect the relevant current state, describe the intended change, then apply the smallest authorized update. Verify the affected resource afterward. Use pagination and narrow log queries. API responses and logs may contain secrets or user data; do not dump broad key/configuration reads unless needed and explicitly requested. Redact credentials from explanations.

Run destructive operations only within explicit user authorization. Use --yes only when that authorization already covers the precise action; it is not permission to expand scope. Stop on 401/403 and fix the connection through supported setup. On validation errors inspect the schema instead of guessing bodies. Keep credentials out of packages and source control.

## Task-specific operating guidance
Read only the reference relevant to the task:
- [Alias and provider changes](references/routing-changes.md): dependency graphs, full-object replacement, metadata, reasoning controls, quota state.
- [Trace investigation and export](references/trace-operations.md): ledger versus body capture, versioned schemas, bounded reads, export integrity.
- [Deployment and development](references/deployment-development.md): staging, migrations, container networking, quota checkers, repository gates.

These references synthesize owner-supplied operational notes. Historical observations are diagnostic leads, not guarantees about every Plexus version. Prefer the target's live schema and matching source revision. Where the OpenAPI document contradicts observed behavior, inspect matching implementation and confirm the route; do not issue speculative writes. A successful write response is insufficient: read back and compare the intended fields.

Use MCP first, the bundled CLI second, and an authenticated REST client only for a verified operation unavailable through those interfaces. Never change interface to evade a permission or authentication denial. Explicit user authorization for the requested change remains valid; ask only when the needed action exceeds it.
