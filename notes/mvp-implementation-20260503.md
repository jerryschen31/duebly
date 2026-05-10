# Duebly MVP implementation (2026-05-03)

## What was implemented

- Created a runnable npm app (React + Vite) at repository root (in the `src` directory).
- Implemented mobile-friendly MVP shell:
   - Top navigation with hamburger menu, clickable **Duebly** title, **Share**, and **Login** buttons.
  - Hamburger menu contains **Set Time Zone** selector.
- Implemented 3 working tabs:
  - **Not Done**: active tasks with due date <= today (in selected timezone), reverse chronological.
  - **Done**: completed tasks, newest completion first.
  - **Planned**: active tasks with due date > today, chronological.
- Implemented add task flow:
  - Requires task text and due date.
  - Defaults due date to current day in selected timezone.
  - New tasks auto-appear in the correct tab based on date.
- Implemented task row behavior:
  - Checkbox toggles done/undone and moves task to the correct tab.
  - Date is directly editable via date input and reclassifies task automatically.
  - Clickable color swatch with 12-color picker.
  - Triple-dot menu with delete action.
- Implemented local persistence with `localStorage` for tasks and selected timezone.
- Added clear empty-state messages for each tab.

## Current MVP limitations (intentional for this run)

- Login is placeholder-only (button exists, no auth flow).
- Share is placeholder-only (button exists, no sharing/sync).
- No backend/cloud sync; data is browser-local only.
- No recurrence logic yet.
- Timezone list is curated, not exhaustive.

## What to add to your notes so a future one-shot can be fully functional

Add these explicit requirements to reduce ambiguity and improve one-shot success:

1. **Exact framework/tooling lock**
   - Specify framework and versions (e.g., Next.js App Router + Tailwind + Dexie, or React + Vite).
   - State whether TypeScript is required.
2. **Task data contract**
   - Final schema with required/optional fields, including `updatedAt`, `completedAt`, recurrence fields, and IDs.
3. **Date/timezone rules**
   - Define whether "today" must always use selected timezone for all filtering/sorting.
   - Define behavior when timezone changes (re-evaluate all task buckets immediately).
4. **Sorting tie-breakers**
   - Define exact secondary sort for same-date tasks in each tab.
5. **UI behavior details**
   - Clarify whether **Add Task** is visible in all tabs or only Not Done/Planned.
   - Specify expected behavior for clicking **Duebly** title and hamburger interactions.
   - Define menu-close behavior (outside click, Escape key, etc.).
6. **Validation/error UX**
   - Required text length limits, invalid date handling, and user-facing validation messages.
7. **Persistence layer target**
   - Explicitly choose localStorage vs IndexedDB (Dexie) for MVP.
8. **Auth + sync acceptance criteria**
   - List exact Kinde setup expectations, OAuth scopes, and first-sync precedence rules.
   - Define conflict-resolution strategy with examples.
9. **PWA scope**
   - State whether installability, offline caching, and update prompt are mandatory for MVP.
10. **Definition of done checklist**
    - Include a concrete pass/fail checklist (core flows + edge cases + browser support targets).

## Quick verification done

- App scaffolds and runs with npm.
- Lint and production build complete successfully.
