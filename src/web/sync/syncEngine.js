// Sync engine implementing the local-first pull-merge-push cycle described
// in remote-storage-implementation.md §6. The engine is intentionally
// independent of any UI framework so it can be unit tested in isolation.
//
// Triggers (per spec §6 "Sync triggers"):
//   - On login / app startup for authenticated user
//   - On `online` reconnect
//   - Debounced after task mutations
//   - Periodic safety sync (interval)
//
// Conflict policy:
//   - Last-Write-Wins on `last_updated`.
//   - Equal timestamps tie-break to remote (deterministic).
//   - Tombstones with newer timestamps win over non-deleted older copies.

import { SyncApiError } from './apiClient.js'

const DEFAULT_DEBOUNCE_MS = 2_000
const DEFAULT_PERIODIC_MS = 5 * 60_000
const MAX_BACKOFF_MS = 60_000

const noop = () => {}

const safeNumber = (value, fallback, { allowZero = false } = {}) => {
  if (allowZero && value === 0) {
    return 0
  }
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export const createSyncEngine = ({
  apiClient,
  storage,
  isAuthenticated = () => false,
  onMerged = noop,
  onStatusChange = noop,
  onError = noop,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  periodicMs = DEFAULT_PERIODIC_MS,
  setTimeoutImpl = (typeof setTimeout === 'function' ? setTimeout : null),
  clearTimeoutImpl = (typeof clearTimeout === 'function' ? clearTimeout : null),
  setIntervalImpl = (typeof setInterval === 'function' ? setInterval : null),
  clearIntervalImpl = (typeof clearInterval === 'function' ? clearInterval : null),
}) => {
  if (!apiClient || typeof apiClient.pullTasks !== 'function' || typeof apiClient.pushTasks !== 'function') {
    throw new Error('createSyncEngine requires a valid apiClient')
  }
  if (
    !storage
    || typeof storage.readAllForSync !== 'function'
    || typeof storage.mergeForSync !== 'function'
    || typeof storage.replaceAllTasks !== 'function'
  ) {
    throw new Error('createSyncEngine requires a valid storage adapter (readAllForSync, mergeForSync, replaceAllTasks)')
  }

  const debounceDelay = safeNumber(debounceMs, DEFAULT_DEBOUNCE_MS)
  const periodicDelay = safeNumber(periodicMs, DEFAULT_PERIODIC_MS, { allowZero: true })

  let started = false
  let inFlight = null
  let queuedReason = null
  let debounceTimer = null
  let periodicTimer = null
  let consecutiveFailures = 0
  let lastSyncAt = null

  const setStatus = (status, detail = {}) => {
    try {
      onStatusChange({ status, ...detail, lastSyncAt })
    } catch {
      // ignore listener errors
    }
  }

  const reportError = (error, reason) => {
    consecutiveFailures += 1
    try {
      onError(error, { reason })
    } catch {
      // ignore listener errors
    }
  }

  const performSync = async (reason) => {
    if (!isAuthenticated()) {
      setStatus('skipped', { reason: 'unauthenticated' })
      return { skipped: true }
    }

    setStatus('syncing', { reason })
    try {
      const localTasks = await storage.readAllForSync()
      const envelope = await apiClient.pullTasks()
      const remoteTasks = Array.isArray(envelope?.tasks) ? envelope.tasks : []

      const equalTimestampConflicts = []
      const merged = storage.mergeForSync(localTasks, remoteTasks, (localTask, remoteTask) => {
        equalTimestampConflicts.push({ localTask, remoteTask })
      })

      await storage.replaceAllTasks(merged)
      await apiClient.pushTasks(merged)

      lastSyncAt = new Date().toISOString()
      consecutiveFailures = 0
      try {
        onMerged(merged, { reason, equalTimestampConflicts })
      } catch {
        // ignore listener errors
      }
      setStatus('idle', { reason })
      return { merged, equalTimestampConflicts, lastSyncAt }
    } catch (error) {
      reportError(error, reason)
      const isAuthError = error instanceof SyncApiError && error.code === 'auth'
      setStatus(isAuthError ? 'unauthenticated' : 'error', { reason, error })
      throw error
    }
  }

  const enqueueSync = (reason) => {
    if (inFlight) {
      // Coalesce overlapping requests; remember that another pass is needed.
      queuedReason = reason
      return inFlight
    }
    inFlight = (async () => {
      try {
        return await performSync(reason)
      } finally {
        inFlight = null
        if (queuedReason) {
          const next = queuedReason
          queuedReason = null
          // Schedule the queued pass without recursive awaits to keep the
          // current promise chain short.
          if (setTimeoutImpl) {
            setTimeoutImpl(() => {
              enqueueSync(next).catch(noop)
            }, 0)
          }
        }
      }
    })()
    return inFlight
  }

  const cancelDebounce = () => {
    if (debounceTimer && clearTimeoutImpl) {
      clearTimeoutImpl(debounceTimer)
    }
    debounceTimer = null
  }

  const triggerDebouncedSync = (reason = 'mutation') => {
    if (!started || !setTimeoutImpl) {
      return
    }
    cancelDebounce()
    debounceTimer = setTimeoutImpl(() => {
      debounceTimer = null
      enqueueSync(reason).catch(noop)
    }, debounceDelay)
  }

  const triggerImmediateSync = (reason = 'manual') => {
    cancelDebounce()
    return enqueueSync(reason)
  }

  const startPeriodicSync = () => {
    if (periodicTimer || !setIntervalImpl || periodicDelay === 0) {
      return
    }
    periodicTimer = setIntervalImpl(() => {
      // Skip when already in flight; performSync will report skipped status
      // for unauthenticated cases.
      if (inFlight) {
        return
      }
      enqueueSync('periodic').catch(noop)
    }, periodicDelay)
  }

  const stopPeriodicSync = () => {
    if (periodicTimer && clearIntervalImpl) {
      clearIntervalImpl(periodicTimer)
    }
    periodicTimer = null
  }

  return {
    start() {
      if (started) {
        return
      }
      started = true
      startPeriodicSync()
    },
    stop() {
      started = false
      cancelDebounce()
      stopPeriodicSync()
    },
    triggerDebouncedSync,
    triggerImmediateSync,
    syncNow: triggerImmediateSync,
    get lastSyncAt() {
      return lastSyncAt
    },
    get isStarted() {
      return started
    },
    get consecutiveFailures() {
      return consecutiveFailures
    },
    get maxBackoffMs() {
      return MAX_BACKOFF_MS
    },
  }
}

export const __test__ = { DEFAULT_DEBOUNCE_MS, DEFAULT_PERIODIC_MS }
