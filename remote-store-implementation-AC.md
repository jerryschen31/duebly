# Remote Storage Backend Acceptance Criteria

Derived from `remote-storage-implementation.md`.

## AC-1 API contract
- `GET /v1/tasks` requires auth and returns a versioned envelope (`schema_version`, `updated_at`, `tasks`).
- If no remote object exists for the authenticated user, `GET /v1/tasks` returns an empty envelope with `tasks: []`.
- `PUT /v1/tasks` requires auth, validates payload, and persists the full snapshot for the authenticated user.

## AC-2 Identity and user isolation
- Requests without a valid bearer token are rejected with 401/403.
- The backend derives `userId` from validated JWT claims only.
- Storage key is server-constructed under `users/{userId}/tasks.v1.json`.
- Data written by one user cannot be read by another user.

## AC-3 CORS and method handling
- Preflight (`OPTIONS`) from allowed origins succeeds with expected CORS headers.
- Preflight from non-allowlisted origins is denied.
- Unsupported methods on `/v1/tasks` return 405.

## AC-4 Validation and guardrails
- `PUT` requires `Content-Type: application/json`.
- Invalid JSON or invalid payload shape is rejected.
- Duplicate task IDs are rejected.
- Each task requires `id` and valid `last_updated`; optional `deleted` must be boolean.
- Task-count limit is enforced (default 5000, configurable).
- Payload byte-size limit is enforced (configurable).

## AC-5 Data integrity behavior
- Successful writes return success metadata (`ok`, `schema_version`, `updated_at`, `task_count`).
- Reads return normalized task payload consistent with stored envelope.
