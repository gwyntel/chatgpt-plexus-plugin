# Alias and provider changes

Source: owner-supplied plexus-alias-fleet-refactor.md and plexus-management.md. Observations span different deployed versions; verify the target schema before choosing fields or routes.

## Before edits
Snapshot relevant aliases and provider state to a protected local file. For bulk retargeting, snapshot the alias graph and enumerate affected references before writing. Preserve rollback objects and identify concurrent changes before replacement. Never publish snapshots: provider responses can include secrets.

Distinguish `{alias: name}` from `{provider: slug, model: upstream_id}`. Matching a model string when asked to change alias references can modify the root instead of its dependents. Follow nested aliases, detect cycles, and inspect additional_aliases for shadowed names. Report the affected aliases and preserve user exclusions.

## Writes and verification
- Treat PUT as replacement: derive the complete object from current state and change only intended fields. Preserve target order, selectors, group names, priorities, metadata, pricing and access_via. Remove groups left empty by target removal.
- Use PATCH only after confirming its deployed merge semantics. The supplied notes report both working PATCH model-map updates and builds where provider PATCH fails. Do not blindly retry with PUT; preserve full current state and establish the cause first.
- URL-encode slugs as path components. Historical alias deletion uses `/v0/management/models/{slug}`, despite read/write paths under `/aliases/{slug}`. Verify the deployed route before deletion. Do not attach JSON content-type to a bodyless request.
- Resolve provider/model references before provider removal. Do not use cascade deletion unless its effects are in the authorized scope.
- Re-read every changed object and compare fields, ordering, expected references, and excluded objects. Success responses can conceal dropped unknown fields.

## Model metadata and reasoning
Query the selected provider's current model catalog; never invent or normalize model IDs across providers. Model autosync has historically been add-only: check actual behavior before assuming it prunes. Before pruning, detect alias references and preserve surviving model pricing.

Context and architecture schemas have changed: notes identify legacy model_architecture.context_length and newer metadata.overrides.context_length/architecture. Inspect the actual schema and persisted values. Do not use top-level context_window without evidence it is supported. Some builds require metadata.overrides.name. Advertising audio/image capabilities does not prove runtime transformation or routing supports them.

Reasoning controls vary by provider and model. Removing an override restores defaults rather than necessarily disabling reasoning. An inherited `reasoning_effort: none` can fail on a later mandatory-reasoning fallback even when the first target succeeds. Verify each affected target within the authorized test budget; do not disable live targets to force testing without authorization. Inspect usage reasoning-token counts and output content as well as reasoning fields. Place overrides only where every affected target supports them.

## Quotas and cooldowns
Distinguish quota-disabled providers from ordinary failure cooldowns. An empty cooldown listing does not prove routing health. Inspect provider enabled state and quota checker output before clearing backoff. Do not unpark quota-exhausted targets merely to make a test pass. Flex/background capacity may be unsuitable for interactive latency; verify current provider semantics instead of treating a timeout as proof of failure.

Alias configuration changes generally do not require restarting the gateway. Do not introduce a restart into an alias edit. Use explicit authorization for outages, resets, or broader changes.
