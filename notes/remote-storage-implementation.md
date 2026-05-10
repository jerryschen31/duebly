# Remote Storage Implementation Plan (Cloudflare R2 + Private Worker)

This document gives an implementation-ready blueprint for adding remote task storage for authenticated users.

## 1) Scope and priorities

### Primary goals
1. **Security and privacy first**: only the authenticated user can read/write their own task data.
2. **Data integrity second**: remote task JSON must not become corrupted or enter a bad state.
3. **Reliable multi-device sync**: local IndexedDB remains active operational storage; remote is durable sync backing store.
4. **Guest-to-user migration UX**: on login, prompt to import **only new guest tasks**.

### Out of scope
- Sharing tasks between users.
- Real-time collaboration.
- Server-side task querying beyond full snapshot read/write.

---

## 2) High-level architecture

- **Frontend app (duebly.app)**
  - Uses existing Kinde login flow.
  - Uses IndexedDB (Dexie) as local source of truth per device/session.
  - Calls private backend API for remote sync using bearer token.

- **Private Cloudflare Worker API (e.g., api.duebly.app)**
  - Verifies JWT from `Authorization: Bearer <token>`.
  - Resolves stable user ID from validated token.
  - Reads/writes user-scoped object in R2.

- **Cloudflare R2 bucket**
  - Stores one object per user snapshot, e.g. `users/{userId}/tasks.v1.json`.

---

## 3) Security model and hard requirements

### Identity and authorization
- Accept only authenticated requests with valid JWT.
- Reject missing/invalid/expired tokens with 401/403.
- Derive `userId` only from validated token claims; never from request body/query/path controlled by client.
- Enforce object path as `users/{userId}/...` built server-side.

### Isolation and privacy
- Never allow arbitrary object key access from client input.
- Never return another user’s data under any condition.
- Use HTTPS only.
- Set strict CORS allowlist to the production frontend origin(s).

### Secret handling
- No secrets in repository, docs examples, logs, test fixtures, CI output, or Terraform plan output.
- Keep Cloudflare/Kinde secrets only in Worker secrets / CI secret store.
- Use least-privilege Cloudflare API token permissions for infra automation.

### Logging and observability safety
- Do not log JWTs, auth headers, raw task payloads, object bodies, or secrets.
- Log only non-sensitive metadata (request ID, status code, latency, user hash/opaque ID if needed).

### Abuse and guardrails
- Enforce payload size limit and task-count limit (target: 5000 tasks/user).
- Enforce content type and JSON schema validation before write.
- Optional rate limiting per user/IP to reduce abuse.

---

## 4) Data model and remote object contract

### Task-level requirements
Each task must contain:
- `id` (stable unique ID)
- `last_updated` (ISO timestamp or epoch; consistent format)
- business fields (title, status, etc.)
- `deleted` boolean (tombstone support; default false)

### Remote object format (versioned envelope)
Store a versioned JSON envelope instead of raw array:

- `schema_version` (e.g., `1`)
- `updated_at` (server write timestamp)
- `tasks` (array of task objects)

This enables future migrations without breaking old clients.

### Integrity controls
- Validate inbound JSON against strict schema.
- Reject malformed or duplicate task IDs.
- Keep deterministic serialization (`JSON.stringify` stable ordering policy if implemented).
- Write whole-object atomically per successful request.

---

## 5) API contract (Worker)

Use minimal endpoints:

1. `GET /v1/tasks`
   - Auth required.
   - Returns user snapshot envelope.
   - If no object exists, return empty envelope (`tasks: []`) with schema version.

2. `PUT /v1/tasks`
   - Auth required.
   - Accepts full envelope or accepted write payload shape.
   - Validates schema + limits.
   - Persists to `users/{userId}/tasks.v1.json`.
   - Returns success metadata.

Optional hardening:
- Include ETag or revision token for optimistic concurrency on full snapshot writes.
- Support idempotency key for retried writes.

---

## 6) Sync strategy (local-first with pull-merge-push)

### Core principles
- IndexedDB is the active store on device.
- Sync compares records by `id` + `last_updated`.
- Conflict policy: **Last Write Wins** by `last_updated`.
- If timestamps are identical, choose **remote** version for deterministic tie-break.

### Pull-merge-push cycle
1. Pull remote snapshot.
2. Build maps by `id` for local and remote.
3. Reconcile in memory:
   - If remote newer or local missing → apply remote to local.
   - If local newer or remote missing → include local in merged output.
4. Handle tombstones correctly (see section 7).
5. Push merged snapshot.

### Sync triggers
- On login / app startup for authenticated user.
- On reconnect (`online` event).
- Debounced after task mutations.
- Periodic safety sync (interval).

### Offline behavior
- Continue local writes with updated `last_updated`.
- Mark sync-required flag.
- On reconnection, run pull-merge-push.

---

## 7) Deletion semantics (anti-resurrection)

To prevent deleted tasks from reappearing:

- Do not treat delete as immediate hard delete for sync state.
- Mark task `deleted: true` and update `last_updated`.
- During merge, tombstone with newer timestamp wins over non-deleted older copy.
- Exclude long-expired tombstones only after safe retention window (e.g., 30 days) and after confirming propagation.

---

## 8) Guest-to-user migration requirement (NEW tasks only)

When user logs in after using guest mode:

1. Compare guest DB and authenticated user DB.
2. Detect **new guest tasks only** (task IDs not present in authenticated dataset).
3. Prompt user:
   - Import new guest tasks
   - Discard guest tasks
4. If import selected:
   - Copy only new tasks into authenticated DB.
   - Set `last_updated` to current time for imported records.
   - Do **not** import guest-side edits to existing tasks.
   - Do **not** import guest-side status changes for existing tasks.
   - Do **not** import guest-side deletions.
5. Clear/retire guest data after explicit user decision.

This behavior is mandatory and must be covered by tests.

---

## 9) Browser data reset recovery

If cookies/site data are cleared:
- User is logged out and local DB is gone.
- After re-login, app initializes empty user DB, runs sync pull, and restores from remote snapshot.
- Only unsynced local-only changes from before the reset are unrecoverable.

Mitigation:
- Eager sync after user edits (debounced short delay).
- Optional `navigator.storage.persist()` request to reduce non-user-initiated eviction risk.

---

## 10) Infrastructure setup (Cloudflare)

### Deployment split
- Keep frontend hosting pipeline separate from private Worker API deployment.
- Frontend calls API endpoint (e.g., `https://api.duebly.app`).

### Worker config
- Configure `wrangler.toml` with R2 binding for production (and optional preview bucket for dev).
- Bind bucket variable used by Worker runtime.

### Terraform responsibilities
- Provision R2 bucket.
- Configure DNS record for API hostname.
- Configure Worker route for API pattern.
- Keep secrets out of Terraform code; inject via secure env vars in CI/runtime.

### Cloudflare token permissions (least privilege)
- Account: Workers R2 Storage (Edit), Workers Scripts (Edit)
- Zone (`duebly.app`): DNS (Edit), Workers Routes (Edit)

---

## 11) Validation and testing checklist

### Security tests
- Unauthorized request denied.
- Token for user A cannot read/write user B object.
- CORS only allows approved origins.
- Logs contain no secrets or payload contents.

### Data integrity tests
- Invalid schema rejected.
- Duplicate IDs rejected.
- Oversized payload/task count rejected.
- Partial/invalid writes do not corrupt previously valid remote data.

### Sync correctness tests
- Local newer wins.
- Remote newer wins.
- Equal timestamp tie picks remote.
- Tombstone propagation prevents resurrection.
- Offline edits sync correctly on reconnect.

### Guest migration tests
- Prompt shown when guest has new tasks.
- Import copies only new tasks.
- Guest edits/status/deletes for existing tasks are ignored.
- Discard path keeps authenticated data unchanged.

---

## 12) Implementation order (recommended)

1. Define shared task schema + envelope schema and validators.
2. Build Worker auth middleware (JWT verify + user ID extraction).
3. Implement `GET /v1/tasks` and `PUT /v1/tasks` with strict validation.
4. Add frontend API client with auth header plumbing.
5. Implement sync engine pull-merge-push with tombstones.
6. Implement guest-to-user new-task-only migration prompt + flow.
7. Add telemetry/alerts with privacy-safe logs.
8. Provision infra (R2, DNS, routes) and configure environments.
9. Run full test checklist and security review before rollout.

---

## 13) Non-negotiable safeguards for coding agents

- Never hardcode credentials/tokens/secrets in any file.
- Never output secrets in logs, CI, or command stdout.
- Never trust client-provided user identifiers.
- Never bypass schema validation before persistence.
- Never permit cross-user reads/writes.
- Never deploy without passing security + sync integrity tests.
