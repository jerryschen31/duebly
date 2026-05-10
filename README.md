# duebly

Initial MVP implementation of the Duebly task app.

[https://duebly.app](https://duebly.app)

Show your support! [Buy me a coffee](https://buymeacoffee.com/duebly)

## Kinde auth

The frontend can enable Kinde login/logout when these client environment variables are present:

```bash
DUEBLY_KINDE_DOMAIN=https://your-domain.kinde.com
DUEBLY_KINDE_CLIENT_ID=your_spa_client_id
DUEBLY_KINDE_REDIRECT_URI=https://duebly.app
DUEBLY_KINDE_LOGOUT_URI=https://duebly.app
DUEBLY_KINDE_AUDIENCE=https://api.duebly.app
```

`DUEBLY_AUTH_ENABLED` is optional; if it is unset, auth turns on automatically when all Kinde variables are configured.
`DUEBLY_KINDE_AUDIENCE` is recommended for remote sync so the fetched access token matches your Worker API audience.

Guest tasks are stored separately from signed-in user tasks. Guest data uses `duebly-guest-db`, while signed-in users use distinct IndexedDB databases named `duebly-user-...-db`.

## Remote sync (Cloudflare R2)

When a user is signed in, the frontend syncs their tasks with the private Cloudflare Worker
described in [`remote-storage-implementation.md`](remote-storage-implementation.md). The
Worker brokers access to a per-user `users/{userId}/duebly-tasks.json` object in R2.

Configure the API location with:

```bash
DUEBLY_API_BASE_URL=https://api.duebly.app   # default
DUEBLY_SYNC_ENABLED=true                     # default; set false to disable sync entirely
DISCARD_GUEST_TASKS=true                     # default; set false to keep guest tasks when "Discard" is clicked
```

The frontend implements a Last-Write-Wins Pull-Merge-Push cycle keyed on each task's
`last_updated` field. Deletions are propagated using tombstones (soft-deleted tasks
retained for 30 days). Sync triggers:

- on app startup / login,
- a 2 second debounce after task mutations,
- the `online` browser event (reconnect),
- and a 15 second periodic safety net.

When a user logs in with tasks created in guest mode, the app prompts to import the
new guest tasks into the user account. Per-task edits, status changes, and deletions
made while signed out are intentionally ignored; only **new** task IDs are imported.
When the prompt is dismissed via **Discard**, guest tasks are deleted by default; set
`DISCARD_GUEST_TASKS=false` to keep guest tasks instead.
