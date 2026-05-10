// Test setup: install a fake IndexedDB implementation so storage.js (which
// uses Dexie) can run in a Node test environment without a browser.

import 'fake-indexeddb/auto'

// Provide import.meta.env defaults expected by the modules under test.
// Vitest exposes import.meta.env automatically, but VITE_ vars defined at
// build time aren't present here. Default behavior matches production:
//   - VITE_DELETE_TASKS_OLDER_THAN_60_DAYS unset -> retention enabled
