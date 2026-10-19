# Deployment and development

Source: owner-supplied plexus-docker-deploy.md, plexus-contributing.md, plexus-quota-checker-development.md and plexus-multi-provider-gateway.md. Infrastructure, provider plans and source layouts in those notes are examples, not portable defaults.

## Deployment
Discover the target host, container runtime, storage paths, version and release process. Inspect current configuration and maintain a rollback plan. Stage and smoke-test an image against a disposable database before an authorized live cutover. A clean-database test does not prove an upgrade works on the existing schema. Inspect migration compatibility and test a protected copy where needed. Do not apply one-off ALTER statements merely because an old incident used them.

Separate build/staging from restart/cutover. Do not restart a shared gateway without authorization covering the interruption. After deployment verify provider enabled flags, aliases and capture settings; they may change or reset. Check disk capacity when reads succeed but all writes fail; do not delete backups automatically.

Use the deployment's existing network model. Container localhost is not the host or another container. Diagnose DNS, routing, TLS and upstream authentication separately. Do not disable TLS validation or change AppArmor/network exposure as a generic workaround.

## MCP authentication
Client-to-Plexus authentication is separate from Plexus-to-upstream credentials. The proxy can strip incoming Authorization and API-key headers and apply configured upstream headers. Successful OAuth can therefore coexist with an upstream 401. Inspect the selected server configuration without revealing secrets. Honcho header requirements depend on that deployment; confirm its required Authorization and X-Honcho-* context fields rather than copying a historical `Bearer local` example.

Discover OAuth metadata from the live challenge and authorization-server document. Do not hard-code a resource identifier, assume root/path discovery conventions, or require restarts based only on old notes. Registration failures mentioning absent tables/columns suggest code/schema drift: inspect the actual schema and supported migration path.

## Source changes and quota checkers
Read the checked-out repository's AGENTS.md and CONTRIBUTING.md before changes. Use its current test/typecheck/format commands, preserve hooks, and follow its migration-generation policy. Historical commands or migration exceptions in attachments do not override the target repository's current rules.

For checker work, inspect the current interfaces, registration mechanism and worker runtime. Built-in and user-provided checkers may use different loading paths. Test deterministic parsing/normalization with fixtures, then separately verify an authorized real upstream check. A synthetic worker test does not prove live credentials or upstream access. Compiled-binary packaging can omit worker assets even when source execution passes; smoke-test the packaged artifact.

Capability metadata is not runtime capability enforcement. Diagnose the transformation and dispatch path when multimodal input is dropped; changing advertised modalities may not preserve audio through protocol conversions or fallback targets. Verify the actual model ID, supported endpoint and payload shape before registering a provider.
