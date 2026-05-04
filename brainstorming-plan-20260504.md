
New features: These detailed specifications are designed for a coding agent to interpret and implement in a modern Vite/React/Tailwind stack.

---

## 1. Natural Language Processing (NLP) Quick-Add
**Objective:** Deterministically extract date information from a text string and return a "clean" task title and a JavaScript `Date` object.

* **Core Library:** Use `chrono-node`. It is the industry standard for non-LLM, deterministic natural language date parsing in JS.
* **Implementation Logic:**
    1.  **Listener:** Create a function `parseTaskInput(inputString)`.
    2.  **Extraction:** Use `chrono.parse(inputString)`. This returns an array of results containing the `text` recognized as a date and the `start` date object.
    3.  **Refinement:** * If a date is found, take the first result.
        * **Task Title:** `inputString.replace(result.text, '').trim()`. Remove extra whitespace.
        * **Due Date:** `result.start.date()`. 
        * **Special Case "Next Week":** If the parsed text is "next week", explicitly set the date to the following Monday at 9:00 AM.
    4.  **UI Feedback:** As the user types, show a small "badge" below the input field showing the recognized date (e.g., "📅 Tomorrow") so the user knows the NLP worked before hitting Enter.

---

## 2. Swipe Gestures
**Objective:** Enable mobile-friendly task management using horizontal drag physics.

* **Core Library:** `framer-motion` (preferred for Vite/React) using the `drag="x"` and `dragConstraints`.
* **Thresholds:** Define a threshold (e.g., 70px).
* **Logic Flow:**
    * **Swipe Left (Negative X):**
        * **Condition:** If `task.status !== 'done'`, trigger `completeTask(id)`.
        * **Condition:** If `task.status === 'done'`, trigger `deleteTask(id)`.
        * **Visual:** Red background with a Trash or Check icon appearing behind the task.
    * **Swipe Right (Positive X):**
        * **Logic:** Trigger `rescheduleTask(id, tomorrow)`.
        * **Recurring Check:** If `task.recurring === 'daily'`, trigger `skipToday(id)` (this updates the task to the next day without marking it "Done").
        * **Visual:** Yellow/Orange background with an "Arrow/Clock" icon.
* **Animation:** Use `AnimatePresence` so tasks slide out and the list collapses smoothly when a task is moved or deleted.

---

## 3. Smart Recurring Tasks
**Objective:** Automate routine task generation without cluttering the database with infinite future instances.

* **Data Schema Update:** Add `recurring: 'daily' | 'weekly' | 'none'` and `originalTaskId: string` (optional, for grouping).
* **Completion Logic:**
    * Inside the `toggleDone` function: 
    * `if (task.recurring !== 'none')`: Instead of moving to "Done," calculate the next occurrence.
    * `daily`: `newDate = currentDueDate + 1 day`.
    * `weekly`: `newDate = currentDueDate + 7 days`.
    * Update the task's `dueDate` to `newDate` and keep `isDone = false`.
* **UI Logic:**
    * In the "Planned" list, use a `.filter()` to only show tasks where `dueDate` is the **next** chronological occurrence.
    * Append `(recurring)` in a subtle, small font next to the task title.
    * **Visual:** Add a "Repeat" icon (🔄) next to the title.

---

## 4. Offline-First and PWA Caching
**Objective:** Ensure the app works in a tunnel/airplane and syncs perfectly when a connection returns.

* **Tech Stack:** `vite-plugin-pwa` for assets; `Dexie.js` for IndexedDB management.
* **Storage Logic:**
    1.  **Local Primary:** All CRUD operations (Create, Read, Update, Delete) happen *first* in Dexie (IndexedDB).
    2.  **Service Worker:** Configure `vite-plugin-pwa` to "CacheFirst" for all static assets (JS, CSS, Icons).
* **Sync Logic:**
    1.  **Timestamping:** Every task object must have a `last_updated` ISO string.
    2.  **Background Sync:** * Listen for the `window.onLine` event.
        * When online, fetch the `todos.json` from the Google Drive `appData` folder.
        * **Conflict Resolution:** Compare `last_updated` of local vs. remote. The one with the more recent timestamp wins.
        * **Push:** Upload the final merged JSON back to Google Drive.



---

## 5. Minimalist Progress Ring
**Objective:** A high-level visual summary of "Today's" productivity.

* **Component Logic:** Create a `ProgressRing.jsx` component using a simple SVG `circle`.
* **Calculation:**
    * `todayTasks = tasks.filter(t => isSameDay(t.dueDate, today))`
    * `total = todayTasks.length`
    * `completed = todayTasks.filter(t => t.isDone).length`
    * `percentage = (completed / total) * 100`
* **Styling:**
    * Use a thin stroke (2px - 4px).
    * **Empty State:** Light gray ring.
    * **Progress State:** Accent color (e.g., Blue or Green) ring that fills using the `stroke-dasharray` property.
    * **Text:** Place a small `completed/total` fraction in the center of the ring.
* **Placement:** Fixed at the top-right of the header or centered at the very top of the "Today" list.

---

### 💡 Agent Implementation Tip:
When implementing the **NLP Quick-Add**, ensure you utilize `chrono.parseDate` if you only need the final object, but `chrono.parse` is necessary to find the specific "substring" to remove from the title. 
