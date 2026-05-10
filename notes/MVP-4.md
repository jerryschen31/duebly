# Duebly MVP-3: Auth + Cloud Sync

## Overview
MVP-3 adds account-based access and cloud backup/sync while preserving the existing fast local-first task experience.

The app remains Dexie-first for all reads/writes. Google Drive AppData becomes the remote persistence layer used for cross-device restore and synchronization.

## High-Level Features

### 1. Kinde Authentication
- Users sign in with Google through Kinde.
- Unauthenticated users see a sign-in experience instead of task data.
- Authenticated users can log out safely.

### 2. Google Drive AppData Remote Backend
- Each authenticated user has a private appdata backup file (duebly_backup.json).
- The app can create, read, and update this backup automatically.
- Data is stored in the hidden AppData folder (not regular Drive files list).

### 3. Local-First Sync Model
- Dexie IndexedDB remains the immediate source for UI state.
- On login, remote and local tasks are merged with last-write-wins by last_updated.
- After local changes, sync uploads are debounced to reduce API traffic.
- If remote sync fails, local editing still works and sync status reports the issue.

### 4. Non-Disruptive UX
- Existing task workflows (create/edit/complete/delete/recurrence/tabs) remain unchanged.
- Sync/auth are additive capabilities, not replacements for core task UX.
- Feature flags allow enabling auth and sync incrementally.

## Expected User Value
- Sign in once and recover tasks across browsers/devices.
- Keep offline/local performance while gaining cloud durability.
- Maintain continuity even during temporary auth or network failures.

## Scope Boundaries for MVP-3
Included:
- Kinde login/logout wiring
- Google Drive AppData pull/push
- Merge and debounce sync behavior
- Basic sync status UI

Not included yet:
- Shared lists/collaboration
- Granular conflict UI
- End-to-end automated test suite
- Multi-provider cloud backends

## Release Safety Approach
MVP-3 can be introduced before formal web tests if shipped with:
- feature flags,
- strict manual verification checklist,
- local-first fallback at all times.

This keeps risk controlled while enabling faster iteration toward full cloud-backed functionality.
