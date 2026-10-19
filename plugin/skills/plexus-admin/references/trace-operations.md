# Trace investigation and export

Source: owner-supplied plexus-traces-forensics.md and plexus-trace-hf-export.md. Treat their table/field examples as version-specific. Discover the deployment and schema first.

## Diagnose capture before analysis
Separate request-usage metadata from optional debug bodies. Compare newest timestamps in the usage ledger and debug store; active traffic with stale debug rows indicates a capture gap, not necessarily an exporter failure. Check current capture toggles. Historical capture state is largely in memory and may reset on restart; do not assume every setting shares that persistence model. Record and restore temporary capture changes within authorization.

Bodies from uncaptured requests cannot be reconstructed from token counts. State the gap. Query a narrow time range and request IDs; redact secrets and user content in results.

## Database fallback
Use the API first. Direct DB access requires authorized access to the intended deployment, not a hard-coded SSH host or container ID. Prefer a read-only SQLite URI and bounded queries; read-only mode prevents writes but does not guarantee zero locks or contention. Inspect tables with PRAGMA before using column names. Historical created_at fields use epoch milliseconds; verify and convert to UTC explicitly.

Resolve nested alias targets to leaves and compare with actual usage records. Group names and public model listings do not prove which provider served a request. A single live inference tests only the target that answered and can incur cost.

Verify filters and pagination empirically: supplied notes report ignored alias/group filters on some builds. If aggregating locally, bound the time window and follow the actual pagination schema. Check whether cached and reasoning tokens are already included in input/output totals before summing; report definitions and avoid double counting.

## Export integrity
Before changing an export pipeline, inspect its actual scripts, checkpoint, destination, retention policy and latest successful run. The attachments refer to scripts not included in this plugin; do not invent them or assume their paths exist.

Use stored reconstructed snapshots for streamed responses when the deployed schema provides them, falling back to raw bodies where appropriate. Detect truncation and missing-body windows. Review and redact secrets before any authorized external upload; token-pattern matching alone is not a guarantee that all sensitive content has been removed.

Require verified upload success before advancing checkpoints or pruning exported bodies. Keep retries idempotent. Do not advance through unexplained empty capture windows or delete the usage ledger as an incidental cleanup. Avoid broad maintenance such as VACUUM during a trace investigation; assess locking, disk space, backup and downtime requirements separately.
