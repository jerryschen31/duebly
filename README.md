# duebly

Initial MVP implementation of the Duebly task app.

## Run locally

```bash
cd src
npm install
npm run dev
```

Then open the localhost URL printed by Vite (usually `http://localhost:5173`).

## Feature flags

Task retention cleanup is enabled by default and deletes tasks with due dates older than 60 days.

- **ON (default, delete old tasks):**
  - Leave `VITE_DELETE_TASKS_OLDER_THAN_60_DAYS` unset, or set it to `true`.
- **OFF (keep full task history):**
  - Set `VITE_DELETE_TASKS_OLDER_THAN_60_DAYS=false`.

Example local override in the Vite app root (`/src/.env` from the repository root):

```bash
VITE_DELETE_TASKS_OLDER_THAN_60_DAYS=false
```

### Auth + Google Drive sync flags

Copy `src/.env.example` to `src/.env` and configure:

```bash
# rollout flags
DUEBLY_AUTH_ENABLED=false
DUEBLY_DRIVE_SYNC_ENABLED=false

# Kinde SPA settings
DUEBLY_KINDE_DOMAIN=https://duebly.kinde.com
DUEBLY_KINDE_CLIENT_ID=...
DUEBLY_KINDE_REDIRECT_URI=https://duebly.app
DUEBLY_KINDE_LOGOUT_URI=https://duebly.app

# Drive sync tuning
DUEBLY_DRIVE_APPDATA_FILENAME=duebly_backup.json
DUEBLY_SYNC_PUSH_DEBOUNCE_MS=3000
```

Behavior:
- If auth is off, app behavior stays local-first and unchanged.
- If `DUEBLY_AUTH_ENABLED` is omitted, auth auto-enables when all required Kinde vars are present.
- With auth on, `/` still loads the local-first task page; sign-in is shown at `/login`.
- If auth is on and sync is off, users can sign in/out with no Drive calls.
- If sync is on and Drive/token calls fail, local editing remains available and status shows an error.

## Deploy
....
