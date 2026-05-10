# Duebly Agent Execution Prompt (1:1 Checklist Mapping)

Use this prompt with a coding agent to implement Kinde auth + Google Drive AppData sync exactly in the sequence below.

## Operating Rules

1. Execute steps in order. Do not reorder.
2. Preserve existing behavior when feature flags are off.
3. Keep Dexie local-first behavior intact.
4. Make additive changes where possible; avoid broad refactors.
5. After each phase, run the specified validation checks before moving on.
6. If a prerequisite is missing (human input required), pause and request that exact missing input.

## Inputs You Must Receive Before Coding (Blockers)

- Token strategy chosen:
  - Kinde provider token in SPA, or
  - token broker fallback.
- Confirmed Kinde callback/logout/origin URLs for local + prod.
- Confirmed Google Drive scope in auth flow: https://www.googleapis.com/auth/drive.appdata.
- Confirmed env variable values for local/dev/prod.

If any item is missing, stop and ask for it before making implementation edits.

## Phase A: Feature Flags and Safe Defaults

### Task A1
- [ ] Add feature flags with safe defaults (auth/sync off).

### Task A2
- [ ] Ensure all auth/sync code paths are gated behind those flags.

### Task A3
- [ ] Verify app behavior is identical to current behavior when flags are off.

## Phase B: Exact File-Level Edit Sequence

### Step 1: Edit src/.env.example (create if missing)
- [ ] Add:
  - `DUEBLY_AUTH_ENABLED=false`
  - `DUEBLY_DRIVE_SYNC_ENABLED=false`
  - `DUEBLY_KINDE_DOMAIN=https://duebly.kinde.com`
  - `DUEBLY_KINDE_CLIENT_ID=(in copilot environment)`
  - `DUEBLY_KINDE_REDIRECT_URI=https://duebly.app`
  - `DUEBLY_KINDE_LOGOUT_URI=https://duebly.app`
  - `DUEBLY_DRIVE_APPDATA_FILENAME=duebly_backup.json`
  - `DUEBLY_SYNC_PUSH_DEBOUNCE_MS=3000`

### Step 2: Edit src/package.json
- [ ] Add required dependencies for Kinde SPA integration.
- [ ] Keep existing scripts unchanged unless strictly necessary.

### Step 3: Create src/web/config/env.js
- [ ] Parse/export feature flags and required env values.
- [ ] Add strict defaults and runtime guards for missing config.

### Step 4: Create src/web/auth/kindeAuth.js
- [ ] Initialize Kinde integration.
- [ ] Export login/logout/session helpers.
- [ ] Export helper to acquire Google Drive-capable access token.

### Step 5: Create src/web/auth/authContext.jsx
- [ ] Implement AuthProvider and useAuth hook.
- [ ] Expose: isAuthenticated, user, login, logout, loading.

### Step 6: Edit src/web/main.jsx
- [ ] Wrap app with AuthProvider when auth flag is enabled.
- [ ] Keep no-auth path unchanged when auth flag is disabled.

### Step 7: Create src/web/sync/googleDriveClient.js
- [ ] Implement getOrCreateAppDataFileId.
- [ ] Implement downloadSnapshot.
- [ ] Implement uploadSnapshot (multipart create/update).
- [ ] Add retry/backoff for 429 and single refresh retry for 401.

### Step 8: Create src/web/sync/snapshot.js
- [ ] Define snapshot schema version, validation, serialization.
- [ ] Normalize remote payload prior to merge.

### Step 9: Create src/web/sync/syncEngine.js
- [ ] Implement pull-on-login bootstrap.
- [ ] Implement merge via taskStorage.mergeForSync.
- [ ] Implement debounced push on local changes.
- [ ] Implement reconnect/foreground pull triggers.
- [ ] Implement sync states: idle, syncing, error, offline.

### Step 10: Edit src/web/storage.js
- [ ] Add only minimal exports/helpers needed by sync engine.
- [ ] Do not change existing task semantics.

### Step 11: Edit src/web/App.jsx
- [ ] Replace placeholder login action with auth actions.
- [ ] Integrate sync engine lifecycle when flags are enabled.
- [ ] Preserve all existing task UI behavior in flagged and unflagged modes.
- [ ] Show minimal sync status indicator.

### Step 12: Edit README.md
- [ ] Add setup docs for Kinde + Google Drive env vars.
- [ ] Add feature flag behavior and fallback notes.

## Phase C: Validation Gates (Run Before Proceeding)

### Gate C1 (after steps 1-3)
- [ ] App boots with flags off.

### Gate C2 (after steps 4-6)
- [ ] Login/logout path works.
- [ ] App remains local-first.

### Gate C3 (after steps 7-9)
- [ ] Drive pull/push works in authenticated mode.

### Gate C4 (after steps 10-11)
- [ ] No regression in create/edit/delete/complete/date-change task flows.

### Gate C5 (after step 12)
- [ ] Docs are accurate for local/dev/prod setup.

## Final Acceptance Checklist (Must Pass Before Merge)

- [ ] With `DUEBLY_AUTH_ENABLED=false` and `DUEBLY_DRIVE_SYNC_ENABLED=false`, behavior matches current app.
- [ ] With auth on and sync off, login/logout works and local task behavior is unchanged.
- [ ] With auth on and sync on, pull/merge/push workflow works end-to-end.
- [ ] Offline edits never block; sync resumes on reconnect.
- [ ] Conflict rule matches plan: last-write-wins by `last_updated`, remote tie-break on equal timestamps.
- [ ] No critical console errors during normal user flows.

## Optional Immediate Post-Merge Tasks (Strongly Recommended)

- [ ] Add minimal smoke tests (Vitest + React Testing Library):
  - auth gate render states
  - merge conflict invariants
  - first-sync precedence behavior
- [ ] Add one Playwright E2E smoke test:
  - sign-in mock
  - create task
  - simulate sync cycle

## Agent Output Format Requirements

After execution, provide:
1. Files changed (with short reason each).
2. Feature flag behavior proof (on/off outcomes).
3. Validation results for each gate.
4. Final acceptance checklist pass/fail with notes.
5. Any blockers that require human decisions.
