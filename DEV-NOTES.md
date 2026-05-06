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

