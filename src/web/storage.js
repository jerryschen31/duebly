import Dexie from 'dexie'

const LEGACY_TASKS_KEY = 'duedly.tasks.v1'
const LEGACY_TIMEZONE_KEY = 'duedly.timezone.v1'

const SETTINGS_KEYS = {
  timezone: 'timezone',
  syncEnabled: 'sync-enabled',
  statusIndicator: 'status-indicator',
}

const RECURRING_VALUES = ['none', 'daily', 'weekly']

const db = new Dexie('duedly-db')
db.version(1).stores({
  tasks: '&id, dueDate, isDone, createdAt, completedAt, recurring, last_updated',
  settings: '&id',
})

const getNow = () => Date.now()
const getNowIso = () => new Date().toISOString()

const safeLocalStorageGet = (key) => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const safeLocalStorageRemove = (key) => {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore storage failures
  }
}

const parseIsoDate = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null
  }

  return trimmed
}

const normalizeStatusIndicator = (value) => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const date = parseIsoDate(typeof value.date === 'string' ? value.date : '')
  if (!date) {
    return null
  }

  const completed = Number.isFinite(value.completed) ? Math.max(0, Math.trunc(value.completed)) : 0
  const total = Number.isFinite(value.total) ? Math.max(0, Math.trunc(value.total)) : 0

  return {
    date,
    completed,
    total,
  }
}

const normalizeTask = (task) => {
  if (!task || typeof task !== 'object') {
    return null
  }

  if (!task.id || !task.text || !task.dueDate) {
    return null
  }

  const dueDate = parseIsoDate(String(task.dueDate))
  if (!dueDate) {
    return null
  }

  const recurring = RECURRING_VALUES.includes(task.recurring) ? task.recurring : 'none'
  const color = typeof task.color === 'string' && task.color ? task.color : '#374151'
  const lastUpdatedCandidate = typeof task.last_updated === 'string' ? task.last_updated : null
  const createdAt = Number.isFinite(task.createdAt) ? task.createdAt : getNow()
  const fallbackLastUpdated = new Date(createdAt).toISOString()
  const lastUpdated = Number.isNaN(Date.parse(lastUpdatedCandidate || ''))
    ? fallbackLastUpdated
    : String(lastUpdatedCandidate)

  return {
    id: String(task.id),
    text: String(task.text),
    dueDate,
    isDone: Boolean(task.isDone),
    color,
    createdAt,
    completedAt: Number.isFinite(task.completedAt) ? task.completedAt : null,
    recurring,
    originalTaskId: typeof task.originalTaskId === 'string' ? task.originalTaskId : null,
    last_updated: lastUpdated,
  }
}

const readLegacyTasks = () => {
  const raw = safeLocalStorageGet(LEGACY_TASKS_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.map(normalizeTask).filter(Boolean)
  } catch {
    return []
  }
}

const readLegacyTimezone = () => {
  const raw = safeLocalStorageGet(LEGACY_TIMEZONE_KEY)
  return typeof raw === 'string' && raw ? raw : null
}

const upsertTasks = async (tasks) => {
  if (!tasks.length) {
    return
  }

  await db.tasks.bulkPut(tasks)
}

const mergeTasks = (localTasks, remoteTasks, onEqualTimestamp) => {
  const byId = new Map()

  for (const task of localTasks) {
    byId.set(task.id, task)
  }

  for (const remoteTask of remoteTasks) {
    const localTask = byId.get(remoteTask.id)
    if (!localTask) {
      byId.set(remoteTask.id, remoteTask)
      continue
    }

    const localTs = Date.parse(localTask.last_updated || '')
    const remoteTs = Date.parse(remoteTask.last_updated || '')

    if (Number.isFinite(localTs) && Number.isFinite(remoteTs) && localTs === remoteTs) {
      if (onEqualTimestamp) {
        onEqualTimestamp(localTask, remoteTask)
      }
      byId.set(remoteTask.id, remoteTask)
      continue
    }

    if (!Number.isFinite(localTs) || remoteTs > localTs) {
      byId.set(remoteTask.id, remoteTask)
    }
  }

  return Array.from(byId.values())
}

const readDexieTasks = async () => {
  const tasks = await db.tasks.toArray()
  return tasks.map(normalizeTask).filter(Boolean)
}

const readSettings = async () => {
  const rows = await db.settings.toArray()
  const map = rows.reduce((acc, row) => {
    acc[row.id] = row.value
    return acc
  }, {})

  return {
    timezone: typeof map[SETTINGS_KEYS.timezone] === 'string' ? map[SETTINGS_KEYS.timezone] : null,
    syncEnabled: Boolean(map[SETTINGS_KEYS.syncEnabled]),
    statusIndicator: normalizeStatusIndicator(map[SETTINGS_KEYS.statusIndicator]),
  }
}

const writeSettings = async (settings) => {
  await db.settings.bulkPut([
    { id: SETTINGS_KEYS.timezone, value: settings.timezone || null },
    { id: SETTINGS_KEYS.syncEnabled, value: Boolean(settings.syncEnabled) },
    { id: SETTINGS_KEYS.statusIndicator, value: normalizeStatusIndicator(settings.statusIndicator) },
  ])
}

const migrateFromLegacy = async () => {
  const legacyTasks = readLegacyTasks()
  const legacyTimezone = readLegacyTimezone()

  if (legacyTasks.length) {
    await upsertTasks(legacyTasks)
  }

  if (legacyTimezone) {
    await db.settings.put({ id: SETTINGS_KEYS.timezone, value: legacyTimezone })
  }
  safeLocalStorageRemove(LEGACY_TASKS_KEY)
  safeLocalStorageRemove(LEGACY_TIMEZONE_KEY)
}

export const taskStorage = {
  async initialize(defaultTimeZone) {
    try {
      await migrateFromLegacy()
      const tasks = await readDexieTasks()
      const settings = await readSettings()

      if (!settings.timezone) {
        settings.timezone = defaultTimeZone
        await writeSettings(settings)
      }

      return {
        tasks,
        settings,
        fallbackActive: false,
      }
    } catch {
      return {
        tasks: [],
        settings: {
          timezone: defaultTimeZone,
          syncEnabled: false,
          statusIndicator: null,
        },
        fallbackActive: false,
      }
    }
  },

  async saveTask(task) {
    await db.tasks.put(normalizeTask(task))
  },

  async deleteTask(taskId) {
    await db.tasks.delete(taskId)
  },

  async saveSettings(settings) {
    await writeSettings(settings)
  },

  mergeForSync(localTasks, remoteTasks, onEqualTimestamp) {
    const normalizedLocal = localTasks.map(normalizeTask).filter(Boolean)
    const normalizedRemote = remoteTasks.map(normalizeTask).filter(Boolean)
    return mergeTasks(normalizedLocal, normalizedRemote, onEqualTimestamp)
  },

  async replaceAllTasks(tasks) {
    const normalizedTasks = tasks.map(normalizeTask).filter(Boolean)
    await db.transaction('rw', db.tasks, async () => {
      await db.tasks.clear()
      if (normalizedTasks.length) {
        await db.tasks.bulkPut(normalizedTasks)
      }
    })
  },
}

export const taskModel = {
  normalizeTask,
  getNowIso,
  getNow,
  recurringValues: RECURRING_VALUES,
}
