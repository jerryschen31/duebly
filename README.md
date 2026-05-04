# duedly

Initial MVP implementation of the Duedly task app.

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

Example local override in `src/.env`:

```bash
VITE_DELETE_TASKS_OLDER_THAN_60_DAYS=false
```

## Deploy
....
