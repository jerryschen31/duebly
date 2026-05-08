**Prompt**
What are some ways to implement the option to select a time of day and display this for a task, without cluttering up the UI for a task with too many elements ? Right now there’s only a day selector and a task shows the day as the due date.

**Response**
To keep the UI clean while adding time support, you need a **progressive disclosure** strategy. This means you hide the time complexity until the user actually indicates they need it.

Here are three ways to implement this in **Duebly** without cluttering the task rows:

---

## 1. The "Split-Pill" Date Button

Instead of adding a new button, transform your existing date selector into a "Split-Pill."

* **How it works:** The button displays `May 6`. If a time is added, it expands to show `May 6, 2:00 PM`.
* **The UI Logic:** When the user taps the date picker, the modal includes a "Set Time" toggle. If off, the task remains "All Day." If on, a time scroller appears. If it is cleaner, an alternative time selector element would be a textfield with the placeholder text "Set time" and a dropdown with every half hour - so the user can either select a time from the dropdown (if it's a half-hour increment) or type in an exact time in the textfield.
* **Display:** On the task list, the time only appears as a small suffix next to the date (e.g., **May 6 • 2:30p**). If no time is set, the suffix is hidden. On this note, currently the tasks display the year. Tasks don't need to display the year if it is the current year (e.g., this year is 2026, so a task that is dated "May 6, 2026" should just display "May 6"). Tasks should 

---

## 2. Natural Language Parsing (The "Smart Input" Way)

This is the cleanest possible UI because it requires **zero** new buttons.

* **How it works:** As the user types in the "Task description" field, the app looks for time-based keywords like "at 5pm" or "tomorrow at noon."
* **The UI Logic:** When a time is detected, a small confirmation chip appears below the text box: `⏰ Set for 5:00 PM?`. Tapping it confirms the time.
* **Display:** The time is stripped from the title and moved to the "Time" metadata field automatically.

---

## 💻 Code Strategy: How to Store It

In your **Dexie** schema, you don't necessarily need a new column. You can modify the `dueDate` to be a full ISO string or a Unix timestamp.

* **All Day Task:** `2026-05-06T11:59:59` (You treat any task with time of 11:59:59 as "Date Only", and make sure if the user does not specify a time, you just make the timestamp 11:59:59.
For the order to list tasks in the "Not Done" list, it should be:
* **Timed Task:** `2026-05-06T14:30:00` (If the time part is not 00:00:00, the UI renders the time).

1. Days are "reverse-chronological", which is how it currently is. So if today is May 7, then the May 7 tasks show at the very top, followed by May 6, followed by May 5, etc...
2. WITHIN a day, the tasks should be 'time-chronological', so tasks earlier in the day display above tasks later in the day. Note that by treating non-timed tasks as 11:59:59, they will naturally appear at the end of the day.

For the order to list tasks in the "Planned" list, it should be:
1. Days are "chronological", which is currently how it is. So if today is May 7, then the May 8 tasks show at the very top, followed by May 9, followed by May 10, etc.
2. WITHIN a day, the tasks should be 'time-chronological', so tasks earlier in the day display above tasks later in the day. Note that by treating non-timed tasks as 11:59:59, they will naturally appear at the end of the day.

---

## 🎨 Visual Hierarchy Best Practice

To avoid clutter in the main list, use **color** to de-emphasize the time:

* **Time:** Medium Gray.

