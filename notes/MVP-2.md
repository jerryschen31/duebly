# MVP-2 Implementation Brief

This file captures implementation requirements for the second MVP phase.

Reference major-feature spec: brainstorming-plan-20260504.md

## Interaction note

- "Click" means short-press on mobile and click on desktop.

## Locked Major-Feature Decisions

1. Dexie/IndexedDB migration is the first and blocking major feature.
2. Smart recurring completion shows a quick toast when task is advanced to the next occurrence.
3. Swipe-right for non-recurring tasks always bumps due date by +1 day and shows a quick toast: "Moved to tomorrow".
4. Swipe-right is enabled only for Not Done tasks, not Planned or Done tasks.
5. Sync strategy is auto-sync on reconnect once auth exists.
6. Conflict tie-break on equal timestamps is prefer remote once Google Drive sync is implemented.
7. Toast system uses a lightweight custom React Context/state component with framer-motion transitions.
8. Migration fallback remains until migration success marker is stable across two launches.
9. Equal timestamp conflicts resolve silently in UI and log to console.warn in development mode only.

## Major Features Dependency Order

Implement in this exact order:

1. Dexie/IndexedDB migration foundation.
2. Swipe gestures.
3. Smart recurring tasks.
4. Offline-first + PWA + deferred auto-sync hooks.
5. Progress ring.

All steps 2-5 depend on step 1 completion.

## Existing UI Issues To Fix

- Hamburger icon appears off-centered on mobile.
- Three-dot task options icon appears off-centered on mobile.
- Clicking outside hamburger menu should close it.
- Clicking outside task options menu should close it.
- Tab bar (Not Done/Done/Planned) should remain visible on top while scrolling.
- Remove Share button from landing page for now.

## Minor Feature Requirements

- Add "Edit task" above "Delete task" in the three-dot menu.
- Edit task flow should focus text input and place cursor at end of current text.
- Replace Add Task color picker grid with compact "Label" dropdown.
- Label dropdown must show all 12 label options with color + category text.
- Label dropdown must close on outside click.
- Selecting a label updates selection and closes dropdown.
- Task row color bubble remains color-only (no visible text label).
- Desktop hover on task color bubble shows label name.
- Mobile long-press on task color bubble shows label name.
- Disable direct tap-to-open color palette on task bubble.
- Add "Change label" action in three-dot task menu to open mobile-friendly label selector.
- Long-press on task description text should select all text.

## Label Categories

Use these 12 labels:

1. General (#374151, default)
2. Priority (#ef4444)
3. Work
4. Life
5. Health
6. Finance
7. Family
8. Home
9. Errands
10. School
11. Event
12. Travel

Color assignment for labels 3-12 can use the existing swatch palette.

## One-Shot Implementation Guardrails

- Follow brainstorming-plan-20260504.md as the source of truth for major features.
- Do not assume a backend database exists.
- Keep data local-first via Dexie; sync is future and auth-gated.
- Keep mobile UX clean, predictable, and easy to use.
- Keep toast implementation lightweight (no heavy toast UI dependency).
- Keep conflict handling non-blocking for users; dev-only warning logs are sufficient.
