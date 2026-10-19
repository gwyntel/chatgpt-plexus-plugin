# ChatGPT Plexus Plugin

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/gwyntel/chatgpt-plexus-plugin)

Connect ChatGPT to a self-hosted [Plexus](https://github.com/mcowger/plexus) gateway.

## Management connection

The hosted adapter uses ChatGPT Sites authentication for browser access and its MCP plugin. Open the private setup page on a phone or computer, sign in, enter the Plexus HTTPS base URL and administrator key, and select **Verify and save connection**. Return to ChatGPT and select the Site's provisioned plugin.

The adapter translates authenticated tool calls to Plexus management MCP requests at `/mcp/plexus`, supplying the administrator key server-side in `x-admin-key`. It does not add OAuth support to Plexus itself. The built-in Plexus OAuth service for proxied MCPs does not currently authorize its management endpoint.

Keys are stored in R2 encrypted with AES-256-GCM under a runtime secret, bound to the Site-scoped user identity. Browser writes require an authenticated, user-bound form token. Explicit foreign origins are rejected; null origins are supported for sandboxed or privacy-preserving browser contexts. Agent tools cannot set or retrieve the saved key. Tool results always request Plexus redaction; the adapter additionally masks the saved administrator key. Other upstream redaction behavior remains Plexus's responsibility.

The adapter has full administrator authority over the chosen instance. The initial Site is owner-private; publishing its source does not publish credentials or grant others access to the deployment. Do not make the deployed Site public without separately reviewing its authentication and network policy.

## Source and hosting

- `worker/index.js`: responsive setup page, encrypted credential storage and stateless MCP endpoint.
- `scripts/test-worker.mjs`: local tests using a mock upstream and mock object storage.
- `.openai/hosting.json`: Sites deployment declaration. The project ID belongs to one deployment; remove it before registering your own Site.
- `CREDENTIAL_ENCRYPTION_KEY`: required 64-character hex secret, configured through hosted runtime settings. Keep it out of Git. Replacing it makes existing encrypted credentials unreadable.
- `BUCKET`: R2 binding used for user connection records.

This deployment uses Sites-managed identity headers. Do not run it behind an arbitrary proxy that accepts user-supplied `oai-authenticated-user-id` headers. A standalone deployment needs a verified identity boundary of its own.

Commands:

```sh
node scripts/test-worker.mjs
bash scripts/build.sh
node scripts/validate-artifact.mjs
```

Publish through the Sites source workflow with the MCP capability enabled. Sites provisions the canonical plugin; do not create a second wrapper plugin for the same Site.

## Remote MCP connections

For upstream servers such as Honcho, use Plexus's `/mcp/<server>` endpoint and its advertised OAuth flow. Upstream credentials belong in Plexus configuration, separately from the client-to-Plexus OAuth grant. The management adapter handles only the reserved `/mcp/plexus` endpoint.

## Verification status

Local tests cover identity, null-origin form protection, encryption, isolation, edge-compatible redirect handling, protocol forwarding, response redaction and connection verification with mocked Plexus responses. On 2026-10-19, the owner completed browser setup and an authenticated read-only management status call succeeded through the installed plugin. Mobile layout uses responsive HTML; native mobile connection has not yet been separately user-verified.

## Public repository export

The intended repository is `gwyntel/chatgpt-plexus-plugin`; the DeepWiki badge above points there. To prepare a clean public source tree without the private Site's project identity or Git history:

```sh
node scripts/export-source.mjs /absolute/new/output-directory
```

Inspect that tree before pushing. `plugin/skills/plexus-admin` holds the bundled administration instructions and CLI. Its setup link is for this deployed private Site; adapt it to a new deployment before distributing your own plugin. The source-pinned upstream CLI retains its MIT license in its scripts directory. Public GitHub source publication is separate from submission to the ChatGPT public plugin directory.

`PUBLIC_ORIGIN` must be set to the public HTTPS origin of your Site. It is used for redirects and origin checks behind the hosting proxy. The adapter does not follow upstream redirects, so configure the final HTTPS Plexus base URL.

### Build a Plexus Connect package

For the second plugin, point a package at one upstream MCP exposed by Plexus:

```sh
node scripts/build-connect-plugin.mjs https://your-plexus.example/mcp/honcho /absolute/new/plexus-connect
```

The output contains portable manifests and the connection skill. Package that directory as one ZIP and import it through Plugin Creator. Configure OAuth on the Plexus instance first. This uses a fixed, explicit endpoint: template-only MCP URLs were not sufficient to register a usable connection. One package connects one named upstream; it does not dynamically mount every server behind Plexus.
