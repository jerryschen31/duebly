import { appEnv } from '../config/env'

const SYNC_STATUS = {
  idle: 'idle',
  syncing: 'syncing',
  success: 'success',
  error: 'error',
  offline: 'offline',
}

export const createSyncEngine = ({
  taskStorage,
  driveClient,
  getLocalState,
  applyLocalState,
  onStatusChange,
}) => {
  let pushTimeoutId = null
  let isBootstrapped = false
  let destroyed = false
  let isSyncEnabled = false

  const setStatus = (nextStatus) => {
    if (!destroyed) {
      onStatusChange(nextStatus)
    }
  }

  const clearPushTimeout = () => {
    if (pushTimeoutId) {
      window.clearTimeout(pushTimeoutId)
      pushTimeoutId = null
    }
  }

  const pushNow = async () => {
    if (!isSyncEnabled || !isBootstrapped || !appEnv.remoteSyncEnabled) {
      return
    }

    if (!navigator.onLine) {
      setStatus(SYNC_STATUS.offline)
      return
    }

    setStatus(SYNC_STATUS.syncing)

    try {
      const localState = getLocalState()
      await driveClient.uploadSnapshot({
        tasks: localState.tasks,
        settings: { timezone: localState.timezone },
      })
      setStatus(SYNC_STATUS.success)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Drive push failed', error)
      }
      setStatus(SYNC_STATUS.error)
    }
  }

  const mergeAndApply = async () => {
    if (!isSyncEnabled || !appEnv.remoteSyncEnabled) {
      return
    }

    if (!navigator.onLine) {
      setStatus(SYNC_STATUS.offline)
      return
    }

    setStatus(SYNC_STATUS.syncing)

    try {
      const localState = getLocalState()
      const remoteSnapshot = await driveClient.downloadSnapshot()

      const remoteTasks = remoteSnapshot?.tasks || []
      const mergedTasks = taskStorage.mergeForSync(localState.tasks, remoteTasks, (localTask, remoteTask) => {
        if (import.meta.env.DEV) {
          console.warn('Equal timestamp conflict resolved with remote preference', {
            localTask,
            remoteTask,
          })
        }
      })

      const mergedTimezone =
        remoteSnapshot?.settings?.timezone || localState.timezone

      await taskStorage.replaceAllTasks(mergedTasks)
      await taskStorage.saveSettings({
        timezone: mergedTimezone,
        syncEnabled: true,
        statusIndicator: localState.statusIndicator,
      })

      applyLocalState({ tasks: mergedTasks, timezone: mergedTimezone })
      await driveClient.uploadSnapshot({
        tasks: mergedTasks,
        settings: { timezone: mergedTimezone },
      })

      setStatus(SYNC_STATUS.success)
      isBootstrapped = true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Drive merge/bootstrap sync failed', error)
      }
      setStatus(SYNC_STATUS.error)
      isBootstrapped = false
    }
  }

  const schedulePush = () => {
    if (!isSyncEnabled || !isBootstrapped || !appEnv.remoteSyncEnabled) {
      return
    }

    clearPushTimeout()
    pushTimeoutId = window.setTimeout(() => {
      pushNow()
    }, appEnv.syncPushDebounceMs)
  }

  const handleOnline = () => {
    if (!isSyncEnabled) {
      return
    }

    mergeAndApply()
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      handleOnline()
    }
  }

  return {
    async start(enabled) {
      isSyncEnabled = Boolean(enabled)
      clearPushTimeout()

      if (!isSyncEnabled || !appEnv.remoteSyncEnabled) {
        isBootstrapped = false
        setStatus(SYNC_STATUS.idle)
        return
      }

      window.addEventListener('online', handleOnline)
      document.addEventListener('visibilitychange', handleVisibilityChange)

      await mergeAndApply()
    },

    stop() {
      isSyncEnabled = false
      clearPushTimeout()
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      setStatus(SYNC_STATUS.idle)
    },

    schedulePush,

    destroy() {
      destroyed = true
      this.stop()
    },

    statuses: SYNC_STATUS,
  }
}
