# Duedly - to-do list app

## Overview

The goal is a simple, web client-only to-do list website to help me (and any other user) keep track of dated tasks.

## Requirements

- Mobile browser friendly
- Tasks MUST have a date assigned. Default when creating a task is the current date, but date is clickable and can be easily changed.
- Ideally, the user can either type the date (valid YYYY-MM-DD format) or select a date from a calendar modal-like element.
- Each task should have a triple dot at the end of the task, that opens a menu with options - e.g., deleting a task.
- The page should have three tabs: “Not Done” (today or previous days), “Done”, and “Planned” (future dated tasks not done yet). These tabs control which list is shown on the page. By default, the "Not Done" tab is shown.
- Client-only - NO backend server, only client side JSONs, client-side storage (database). Future feature is Google login with connection to special Google Drive folder for persistent data storage.
- Site is ALWAYS aware of the current date.

## UI/UX Features

### Overall Page
- There should be a top nav-bar with a hamburger menu on the top-left, and two buttons at the top-right - "Share" and "Login". Just to the right of the hamburger menu should be a clickable header text "Duedly". The nav-bar should look like what is on this landing page: https://kinnoo.ai
- A div element "tab-bar" with the same height (or a bit thinner) as the nav-bar should span the entire width of the page, and should show three clickable buttons for the 3 different tabs: "Not Done", "Done", "Planned". Clicking on a button will show the respective to-do list.
- The main div element below this "tab-bar" div element shows the main to-do list. By default, the "Not Done" list is shown. This main div element is the to-do list that takes up the remainder of the page.
- The hamburger menu should have one element - "Set Time Zone". Clicking on this should show a list of time zones and allow the user to select the time zone.
- 
### "Not Done" main div element

- Should be a to-do task list showing a reverse chronological date-ordered list (today's tasks at the top) showing all tasks not done yet.
- A user can add tasks into this list (easiest would be a "Add Task" button at the top above the task list). If a date is selected that isin the future, the task AUTOMATICALLY gets moved into the "Planned" list.
- A task should look like the following: "[ ] (2026-04-05) 🟪 Pay my taxes. :"
  - The color preview / color swatch element (e.g. - 🟪) should be clickable. Should be dark gray by default. Clicking on it shows a rainbow of 12 colors, which a user can use to change the color of the color swatch. For the MVP, this can be used to distinguish different categories of tasks.
  - The date should be clickable - clicking on it allows the user to change the date (either by manually typing or by selecting a date from a calendar modal-like element).
  - The ":" shown on the end actually should be a triple dot. Clicking on the triple dot opens a menu with options. For now, the only option should be to delete a task (which should of course remove it).
  - The [ ] should be a checkbox element that, when clicked, renders the element as "checked" and moves the task to "Done".

### "Done" main div element
- Should be a to-do task list showing a reverse chronological date-ordered list showing all completed tasks.
- A task here should look the same as tasks in the "Not Done" list, with the exception of the checkbox element being "checked". Clicking on this checkbox element "unchecks" the element and moves the task back to "Not Done".

### "Planned" main div element
- Should be a to-do task list showing a chronological date-ordered list showing all planned tasks.
- Tasks here should look the same as tasks in the "Not Done" list.
- A user can add tasks into this list (easiest would be a "Add Task" button at the top above the task list). If a date is selected that is NOT in the future, the task AUTOMATICALLY gets moved into the "Not Done" list.
- Clicking on the checkbox element for a task in this list should move it to the "Done" list.
