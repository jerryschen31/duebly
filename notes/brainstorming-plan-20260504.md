New features for MVP-2: these specifications are implementation-ready for the current app and locked product decisions.

Current stack baseline for MVP-2:

- Frontend: React + Vite, plain CSS.
- Local persistence target for MVP-2: Dexie on IndexedDB (replacing localStorage as primary task store).
- Backend today: none.
- Future sync target: authenticated Google Drive appData JSON file.
- All major features below depend on Feature 1 completion.

---

## 1. Dexie/IndexedDB Migration Foundation (Blocking)
Objective: migrate task/settings persistence from localStorage to Dexie/IndexedDB with safe one-time data migration.

Implementation instructions:

- Add Dexie and create a client-side DB module.
- Define Dexie schema for at least:
    - tasks table keyed by id.
    - settings table keyed by id/name (timezone and future sync flags).
- Extend task data model now to support upcoming features:
    - id: string
    - text: string
    - dueDate: YYYY-MM-DD
    - isDone: boolean
    - color: hex string
    - createdAt: number
    - completedAt: number | null
    - recurring: 'none' | 'daily' | 'weekly'
    - originalTaskId: string | null
    - last_updated: ISO string
- Implement one-time migration:
    - Read existing localStorage keys for tasks and timezone.
    - Normalize/validate entries.
    - Upsert into Dexie.
    - Set a migration-complete flag.
    - Do not delete localStorage immediately; keep temporary fallback for one release.
- Refactor state CRUD paths to use a storage adapter backed by Dexie:
    - loadTasks, saveTask, updateTask, deleteTask, loadSettings, saveSettings.
- Ensure all mutations update last_updated consistently.
- Migration fallback policy (locked):
    - Keep localStorage fallback until migration success marker is stable across two launches.
    - "Stable across two launches" means migration marker exists and Dexie load/validation succeeds on two consecutive app starts.

Things to watch for:

- This feature is a blocker for all features below.
- Do not keep two competing sources of truth after migration; Dexie must be primary.
- Preserve compatibility with previously saved task objects missing new fields.
- Keep UI responsive; avoid blocking renders on large synchronous migrations.
- Keep all logic frontend-only; do not add backend assumptions.
- Do not remove localStorage fallback before two-launch migration stability is confirmed.

---

## 2. Swipe Gestures (Depends on Feature 1)
Objective: enable mobile-friendly horizontal gestures for fast task actions.

Implementation instructions:

- Use framer-motion drag on x-axis for task rows.
- Use action threshold (for example, 70px) and commit on drag end.
- Left swipe behavior:
    - Not Done task: mark done.
    - Done task: delete.
- Right swipe behavior (locked):
    - Applies only to Not Done tasks.
    - Never applies to Planned or Done tasks.
    - Action: bump dueDate by +1 day (tomorrow in selected timezone).
    - Show toast: "Moved to tomorrow".
- Show visual action backgrounds during drag:
    - Left: red + check/trash icon based on state.
    - Right: yellow/orange + clock/arrow icon.
- Animate removal/reflow with AnimatePresence.
- Persist gesture-driven updates through Dexie adapter methods.
- Toast feedback requirement:
    - Use a lightweight custom toast system (React Context + local state queue).
    - Use framer-motion transitions for enter/exit.
    - Keep styling lightweight and consistent with app UI (no heavy UI library dependency).

Things to watch for:

- Do not trigger right-swipe behavior in Planned or Done tabs.
- Avoid accidental commits on slight drags.
- Prevent drag from breaking vertical scroll on mobile.
- Keep checkbox/date/menu interactions fully usable.
- Maintain keyboard-accessible equivalents for gesture actions.

---

## 3. Smart Recurring Tasks (Depends on Feature 1)
Objective: support recurring task behavior without creating infinite future task copies.

Implementation instructions:

- Use recurring fields from Feature 1 schema.
- Keep one active row per recurring task series.
- Completion logic:
    - recurring = none: existing done toggle behavior.
    - recurring = daily/weekly and user marks complete:
        - Advance dueDate by +1 day or +7 days.
        - Keep isDone = false.
        - Clear completedAt.
        - Update last_updated.
        - Show toast: "Moved to next occurrence".
- Show recurring UI affordance:
    - Repeat icon next to task text.
    - subtle "(recurring)" marker.
- Planned list should show next upcoming occurrence only (same task row after dueDate change).

Things to watch for:

- Do not clone recurring tasks into multiple future instances.
- Keep date math timezone-safe.
- Ensure recurring completion does not leave task in Done tab.
- Backfill missing recurring fields for old tasks during read/normalize.

---

## 4. Offline-First, PWA, and Future Google Drive Sync (Depends on Feature 1)
Objective: keep app fully offline-capable now and future-ready for authenticated remote sync.

Implementation instructions:

- Local-first rule:
    - All CRUD reads/writes go to Dexie first.
    - UI always reflects local data immediately.
- PWA:
    - Add vite-plugin-pwa for static asset caching.
    - Start with conservative cache config.
- Sync behavior (deferred until auth exists):
    - Implement architecture hooks/interfaces now, but actual sync activation only after auth is implemented.
    - On reconnect (window online event), if authenticated, auto-sync starts.
    - Merge local Dexie tasks with remote todos.json by id + last_updated.
    - Conflict policy locked: if timestamps are equal, prefer remote.
    - Persist merged output locally, then upload merged JSON remote.
    - Conflict observability policy (locked): resolve silently in UI and emit console.warn in development mode only.

Things to watch for:

- Do not imply sync is active before auth exists.
- Do not replace local dataset blindly; always do per-record merge.
- Keep app usable when offline, auth missing, or sync fails.
- Log/trace sync failures for debugging without crashing UI.
- Do not show user-facing conflict popups for equal timestamp conflicts.

---

## 5. Minimalist Progress Ring (Depends on Feature 1)
Objective: show a compact summary of today completion progress.

Implementation instructions:

- Build ProgressRing component using SVG circles.
- Use today (selected timezone) and current tasks from Dexie-backed state.
- Compute:
    - todayTasks where dueDate === today.
    - total, completed, percentage (guard total = 0).
- Visual:
    - Thin stroke.
    - Light gray empty ring.
    - Accent progress arc via stroke-dasharray/stroke-dashoffset.
    - Center text completed/total.
- Place near app title in top nav with responsive behavior.

Things to watch for:

- Prevent divide-by-zero.
- Ensure readability at small mobile sizes.
- Keep nav layout stable.
- Memoize derived values to reduce unnecessary renders.

---

## Locked Product Decisions (Do Not Re-open During Implementation)

1. Storage now: migrate to Dexie/IndexedDB immediately.
2. Recurring completion: show quick toast when advanced to next occurrence.
3. Swipe-right for non-recurring: always +1 day, with toast "Moved to tomorrow".
4. Swipe-right scope: only Not Done tasks, never Planned or Done.
5. Sync strategy: auto-sync on reconnect once auth exists.
6. Equal timestamp conflict tie-break: prefer remote (Google Drive record).
7. Toasts: use a lightweight custom toast component (React Context/state + framer-motion transitions).
8. Migration fallback removal: only after migration marker is stable across two launches.
9. Equal timestamp conflicts: resolve silently, log via console.warn in development mode only.

---

## Agent Guardrails

- Implement in dependency order from Feature 1 to Feature 5.
- Keep changes incremental and verifiable at each feature boundary.
- Do not assume Tailwind classes or backend APIs.
- Keep implementation strictly local-first until auth and sync are explicitly enabled.
