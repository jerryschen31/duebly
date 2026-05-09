# Duebly Phase 4 Plan (2026-05-05)

## Goal
Wire Kinde Google social login into the existing Vite + React app and add Google Drive AppData as the remote task backend, while keeping IndexedDB (Dexie) as the primary local store and sync layer.

## Executive Assessment
This is feasible to implement cleanly before adding full web test coverage, if done behind feature flags and with a strict fallback strategy.

- Difficulty: Medium to high (auth + OAuth scopes + sync edge cases).
- Main technical risk: Token lifecycle and provider-token availability for Google Drive API calls.
- Main product risk: Silent sync conflicts or auth session edge cases without tests.
- Recommendation: Proceed now, but do incremental rollout with local-only fallback always available.

## Current Codebase Anchors
- Storage and merge logic already exists in src/web/storage.js (normalizeTask, mergeForSync, replaceAllTasks).
- App has a sync service placeholder in src/web/App.jsx:
  - syncService.isAuthenticated
  - syncService.pullRemoteTasks
  - syncService.pushMergedTasks
- Existing app works fully local-first with Dexie.

This makes integration practical without large rewrites.

## Prerequisites (Human-Verified)
The following must be confirmed before coding starts. Mark each item as complete.

### Identity / Kinde
- Kinde app type supports browser SPA with PKCE. [yes]
- Allowed callback URLs include local and production URLs. [yes]
- Allowed logout redirect URLs include local and production URLs. [yes]
- Allowed origins include local and production frontend origins. [yes]
- Google social connection is enabled in Kinde. [yes]
- Kinde authorization request includes Google Drive scope: https://www.googleapis.com/auth/drive.appdata. [yes]
- Confirm whether the frontend can retrieve a valid Google access token from Kinde session APIs. [won't know until we implement login]

### Google Cloud
- OAuth consent screen configured and published/test-mode users added. [yes]
- OAuth client type is Web application. [yes]
- Drive API enabled in Google Cloud project. [yes]
- Scope authorized: https://www.googleapis.com/auth/drive.appdata. [yes]
- If refresh tokens are needed, policy for offline access is defined. [not sure]

### Runtime / Env
- No hardcoded API tokens in source.
- All auth config comes from environment variables.
- Separate envs for local/dev/prod are prepared.

## Critical Design Decision (Must Resolve First)
You need one of these token strategies:

1. Preferred: Kinde exposes Google provider access token to the SPA. [this one]
2. Alternative: Add a minimal backend token broker (Cloudflare Worker) to exchange/refresh tokens securely.

If neither is available, direct Drive AppData sync from frontend cannot be done reliably.

## Proposed Architecture

### Auth Layer
- Add an auth provider module for Kinde SPA PKCE.
- Expose:
  - login()
  - logout()
  - isAuthenticated()
  - getUser()
  - getGoogleAccessToken() (or token broker call)
- Keep auth state in React context/hook.

### Remote Data Layer (Drive AppData)
- Add a Drive service module that:
  - finds or creates appdata file (duebly_backup.json)
  - downloads JSON snapshot
  - uploads JSON snapshot with updatedAt
  - stores/reuses fileId for efficiency
- Use Drive v3 endpoints:
  - files.list (spaces=appDataFolder)
  - files.create (parents=[appDataFolder])
  - files.get (alt=media)
  - files.update (uploadType=multipart)

### Sync Engine
- Keep Dexie as source of truth for UI reads/writes.
- On login:
  - pull remote snapshot
  - merge with local using existing last_updated logic
  - write merged set to Dexie
  - push merged snapshot back to Drive
- During active session:
  - debounce push after local task/settings changes (2-3s)
- On startup while logged out:
  - app still works local-only.

### Conflict Strategy
- Last write wins per task based on last_updated.
- Tie-breaker on equal timestamps: prefer remote, log metric.
- Maintain monotonic updatedAt at snapshot level.

## Data Contracts

### Task (existing)
Use existing normalized task shape from src/web/storage.js.

### Remote Snapshot JSON
{
  "version": 1,
  "updatedAt": "2026-05-05T12:00:00.000Z",
  "tasks": [ ...normalized tasks... ],
  "settings": {
    "timezone": "America/Los_Angeles"
  },
  "metadata": {
    "source": "duebly-web",
    "schema": "task-snapshot-v1"
  }
}

Notes:
- Keep settings payload minimal at first (timezone only).
- Preserve forward compatibility with version field.

## Feature Flags (Required for Clean Rollout)
Add these Vite env flags:
- VITE_ENABLE_AUTH=true|false
- VITE_ENABLE_REMOTE_SYNC=true|false
- VITE_SYNC_PUSH_DEBOUNCE_MS=3000
- VITE_DRIVE_APPDATA_FILENAME=duebly_backup.json

Behavior:
- If auth disabled: current local behavior unchanged.
- If sync disabled: auth can still work, but no Drive calls.
- If Drive/token fails: do not block task editing; show sync warning state.

## Step-by-Step Implementation Plan (Agent-Executable)

### Phase 0: Setup and scaffolding
1. Install dependencies for Kinde SPA integration.
2. Add env variable templates in src/.env.example.
3. Create modules:
   - src/web/auth/kindeAuth.js
   - src/web/sync/driveClient.js
   - src/web/sync/snapshot.js
   - src/web/sync/syncEngine.js
4. Add lightweight logger utility for sync/auth diagnostics.

### Phase 1: Kinde wiring
1. Implement AuthProvider and useAuth hook.
2. Add Login/Logout controls in top nav (replace placeholder login behavior).
3. Add guarded initialization:
   - if auth enabled and unauthenticated: show sign-in view
   - if authenticated: initialize app + sync bootstrap
4. Preserve existing UI/task behavior after auth state is established.

### Phase 2: Drive AppData client
1. Implement getOrCreateBackupFileId(filename).
2. Implement downloadSnapshot(fileId) with robust JSON validation.
3. Implement uploadSnapshot(fileId, snapshot) with multipart upload.
4. Handle 401/403 with token refresh retry path (single retry max).

### Phase 3: Sync integration
1. Replace syncService placeholder in src/web/App.jsx with syncEngine integration.
2. On authenticated app load:
   - read local tasks/settings
   - pull remote snapshot
   - merge via taskStorage.mergeForSync
   - persist merged tasks via taskStorage.replaceAllTasks
   - push merged snapshot
3. Add debounced push trigger whenever tasks/settings change after initialization.
4. Add sync status indicator states:
   - idle, syncing, success, error, offline

### Phase 4: Hardening
1. Ensure app remains usable when:
   - no network
   - Drive API error
   - token expires
2. Ensure no duplicate recurring tasks from sync loop.
3. Add backoff for repeated sync failures.
4. Add small in-app diagnostics panel in dev mode (optional).

### Phase 5: Documentation and operator runbook
1. Update README with auth/sync setup steps and env vars.
2. Add manual verification checklist (below).
3. Document known limitations and expected conflict behavior.

## Manual Verification Checklist (No Test Suite Yet)
Run this before considering the feature stable:

1. Local-only mode still behaves exactly as before.
2. Login success path loads existing local tasks.
3. First remote sync creates appdata file.
4. Logout then login restores tasks from Drive.
5. Two-browser conflict test resolves by last_updated.
6. Offline edits sync correctly on reconnect.
7. Token expiry path recovers or degrades gracefully.
8. App remains fully editable if sync fails.
9. Recurring task completion does not duplicate unexpectedly.
10. Timezone setting remains consistent after round-trip sync.

## Risks and Mitigations
- Risk: Kinde does not expose Google provider token in SPA.
  - Mitigation: token broker via Cloudflare Worker.
- Risk: No automated tests means regression risk in core task UX.
  - Mitigation: feature flags + strict manual QA matrix + staged rollout.
- Risk: Sync loop churn due to non-stable timestamps.
  - Mitigation: update last_updated only on true task mutations.

## Can this be done cleanly before tests exist?
Yes, with constraints.

Reasonable if all below are true:
- Auth/sync are behind flags and can be disabled instantly.
- Local task operations never block on remote calls.
- Manual QA checklist is executed for every merge.
- Implementation is modular (auth/sync isolated from task UI logic).

Not reasonable if:
- You cannot reliably obtain/refresh Google access tokens.
- You plan to ship to many users immediately without any smoke automation.

## Recommended Next Action Order
1. Resolve token strategy (Kinde provider token vs token broker).
2. Implement Phase 0-3 behind flags.
3. Run the full manual checklist.
4. Add minimal smoke tests (auth gate + create task + sync pull/push) as soon as implementation stabilizes.

## Concrete Implementation Task Checklist (Coding Agent)

Use this checklist as the execution order. Do not reorder steps. Keep existing behavior unchanged when feature flags are off.

### A. Human Inputs Before Agent Starts

- [y] Confirm token strategy: Kinde provider token in SPA [this one], or token broker fallback.
- [y] Confirm final callback/logout/origin URLs in Kinde for local + prod.
- [y] Confirm Drive scope is granted in auth flow: https://www.googleapis.com/auth/drive.appdata.
- [y] Confirm environment variable names and values for local/dev/prod.
Saved in copilot environment variables as env vars / secrets:
DUEBLY_KINDE_CLIENT_ID
DUEBLY_KINDE_DOMAIN
DUEBLY_GOOGLE_CLIENT_ID
DUEBLY_KINDE_REDIRECT_URI
DUEBLY_KINDE_LOGOUT_URI

### B. Feature Flags and Safe Defaults (must be first)

- [ ] Add feature flags with safe defaults (auth/sync off).
- [ ] Ensure all auth/sync code paths are gated.
- [ ] Verify app behavior is identical to current build when flags are off.

### C. Exact File-Level Edit Sequence

1. Edit [src/.env.example](src/.env.example) (create if missing)
- [ ] Add documented variables:
  - `DUEBLY_AUTH_ENABLED=false`
  - `DUEBLY_DRIVE_SYNC_ENABLED=false`
  - `DUEBLY_KINDE_DOMAIN=https://duebly.kinde.com`
  - `DUEBLY_KINDE_CLIENT_ID=(in copilot environment)`
  - `DUEBLY_KINDE_REDIRECT_URI=https://duebly.app`
  - `DUEBLY_KINDE_LOGOUT_URI=https://duebly.app`
  - `DUEBLY_DRIVE_APPDATA_FILENAME=duebly_backup.json`
  - `DUEBLY_SYNC_PUSH_DEBOUNCE_MS=3000`

2. Edit [src/package.json](src/package.json)
- [ ] Add required dependencies for Kinde SPA integration.
- [ ] Keep existing scripts unchanged unless strictly necessary.

3. Create [src/web/config/env.js](src/web/config/env.js)
- [ ] Parse and export all feature flags and required env values.
- [ ] Provide strict defaults and runtime guards for missing config.

4. Create [src/web/auth/kindeAuth.js](src/web/auth/kindeAuth.js)
- [ ] Initialize Kinde client/provider integration.
- [ ] Export login/logout/session helpers.
- [ ] Export helper for acquiring Google Drive-capable access token.

5. Create [src/web/auth/authContext.jsx](src/web/auth/authContext.jsx)
- [ ] Implement `AuthProvider` and `useAuth` hook.
- [ ] Expose `isAuthenticated`, `user`, `login`, `logout`, `loading`.

6. Edit [src/web/main.jsx](src/web/main.jsx)
- [ ] Wrap app with `AuthProvider` when auth flag is enabled.
- [ ] Keep no-auth mode path unchanged when auth flag is disabled.

7. Create [src/web/sync/googleDriveClient.js](src/web/sync/googleDriveClient.js)
- [ ] Implement `getOrCreateAppDataFileId`.
- [ ] Implement `downloadSnapshot`.
- [ ] Implement `uploadSnapshot` (multipart update/create).
- [ ] Add retry/backoff for 429 and single refresh retry for 401.

8. Create [src/web/sync/snapshot.js](src/web/sync/snapshot.js)
- [ ] Define snapshot schema version, validation, and serialization.
- [ ] Normalize remote payload before merge.

9. Create [src/web/sync/syncEngine.js](src/web/sync/syncEngine.js)
- [ ] Implement pull-on-login bootstrap.
- [ ] Implement merge using existing `taskStorage.mergeForSync`.
- [ ] Implement debounced push on local changes.
- [ ] Implement reconnect/foreground pull.
- [ ] Implement sync state transitions (`idle`, `syncing`, `error`, `offline`).

10. Edit [src/web/storage.js](src/web/storage.js)
- [ ] Add only minimal exports/helpers needed by sync engine.
- [ ] Do not alter existing task semantics.

11. Edit [src/web/App.jsx](src/web/App.jsx)
- [ ] Replace placeholder login action with auth actions.
- [ ] Integrate sync engine lifecycle when flags are enabled.
- [ ] Preserve existing task UI behavior in both flagged and unflagged modes.
- [ ] Show minimal sync status indicator.

12. Edit [README.md](README.md)
- [ ] Add setup section for Kinde + Google Drive env vars.
- [ ] Add feature-flag behavior and fallback behavior notes.

### D. Agent Validation Steps After Each Edit Group

- [ ] After steps 1-3: app still boots with flags off.
- [ ] After steps 4-6: login/logout path works, app still local-first.
- [ ] After steps 7-9: Drive pull/push works in authenticated mode.
- [ ] After steps 10-11: no regression in add/edit/delete/complete/date-change flows.
- [ ] After step 12: docs are accurate for local/dev/prod setup.

### E. Final Acceptance Gate (must pass before merge)

- [ ] With `VITE_AUTH_ENABLED=false` and `VITE_DRIVE_SYNC_ENABLED=false`, behavior matches current app.
- [ ] With auth on and sync off, login/logout works and local task behavior is unchanged.
- [ ] With auth on and sync on, pull/merge/push workflow functions end-to-end.
- [ ] Offline edits never block and sync resumes on reconnect.
- [ ] Conflict rule behavior matches plan (last-write-wins by `last_updated`; remote tie-break on equal).
- [ ] No critical console errors during normal user flows.

### F. Optional but Strongly Recommended Immediately After Merge

- [ ] Add minimal automated smoke tests (Vitest + React Testing Library):
  - auth gate rendering states
  - merge conflict invariants
  - first-sync precedence behavior
- [ ] Add one E2E smoke test (Playwright): sign in mock, create task, simulate sync cycle.
