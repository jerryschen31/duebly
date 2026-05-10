// Guest-to-user migration helpers. Implements the strict
// "new tasks only" import policy from
// remote-storage-implementation.md §8.

import { taskStorage } from '../storage.js'

/**
 * Inspects the guest DB without changing the active profile and returns
 * tasks that should be offered for import into the authenticated user's
 * dataset (i.e. guest task IDs not already present on the user side).
 *
 * Guest-side edits, status changes, and deletions of IDs that already
 * exist on the user side are intentionally ignored.
 */
export const detectImportableGuestTasks = async ({ activeUserTasks } = {}) => {
  const guestTasks = await taskStorage.readGuestTasks()
  const userTasks = Array.isArray(activeUserTasks)
    ? activeUserTasks
    : (await taskStorage.readAllForSync())
  const importable = taskStorage.computeNewGuestTasks(guestTasks, userTasks)
  return { guestTasks, importable }
}

/**
 * Imports the supplied new guest tasks into the *currently active*
 * user database. Caller is responsible for ensuring the active profile
 * is the signed-in user's profile before invoking this.
 */
export const importGuestTasks = async (importableTasks) => {
  if (!Array.isArray(importableTasks) || !importableTasks.length) {
    return []
  }
  return taskStorage.importNewGuestTasks(importableTasks)
}

/**
 * Discards (wipes) the guest dataset. Used after the user has either
 * imported or explicitly chosen to discard the guest tasks.
 */
export const discardGuestData = async () => {
  await taskStorage.wipeGuestData()
}
