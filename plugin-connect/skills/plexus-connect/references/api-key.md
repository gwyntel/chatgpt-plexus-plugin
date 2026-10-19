# API-key variant

Keep the same server type and URL templates. Replace only extensions.com.openai.auth in mcp.json with:

```json
{"type":"api_key","headerScheme":"bearer"}
```

Use a Plexus API key scoped to the intended MCP server through the secure connection setup. Do not package the key. Upstream credentials remain configured in Plexus. The source at commit 77922cbeb003ce9178eb2a6220dcf9af76c3571d verifies both raw API keys and OAuth bearer tokens on proxy routes. Older OpenAPI proxy documentation claiming no authentication is stale for that revision. Verify compatibility with the target deployment.
