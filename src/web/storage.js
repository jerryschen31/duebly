import Dexie from 'dexie'

const LEGACY_TASKS_KEY = 'duebly.tasks.v1'
const LEGACY_TIMEZONE_KEY = 'duebly.timezone.v1'

const SETTINGS_KEYS = {
  timezone: 'timezone',
  language: 'language',
  syncEnabled: 'sync-enabled',
}

const RECURRING_VALUES = ['none', 'daily', 'weekly', 'weekdays']
const TASK_RETENTION_DAYS = 60
// Issue #13 specifies 11:59:59 as the date-only task sentinel.
const ALL_DAY_SENTINEL_TIME = '11:59:59'

const parseBooleanFlag = (value, defaultValue) => {
  if (typeof value !== 'string') {
    return defaultValue
  }

  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return defaultValue
}

const shouldDeleteOldTasks = parseBooleanFlag(
  import.meta.env.VITE_DELETE_TASKS_OLDER_THAN_60_DAYS,
  true,
)

const db = new Dexie('duebly-db')
db.version(1).stores({
  tasks: '&id, dueDate, isDone, createdAt, completedAt, recurring, last_updated',
  settings: '&id',
})
db.version(2).stores({
  tasks: '&id, dueDate, dueEndTime, isDone, createdAt, completedAt, recurring, last_updated',
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T${ALL_DAY_SENTINEL_TIME}`
  }

  const dateTimeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!dateTimeMatch) {
    return null
  }

  const [, datePart, hours, minutes, seconds = '00'] = dateTimeMatch
  const hourNumber = Number(hours)
  const minuteNumber = Number(minutes)
  const secondNumber = Number(seconds)
  if (hourNumber > 23 || minuteNumber > 59 || secondNumber > 59) {
    return null
  }

  return `${datePart}T${hours}:${minutes}:${seconds}`
}

const parseClockTime = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) {
    return null
  }

  const [, hours, minutes, seconds = '00'] = match
  const hourNumber = Number(hours)
  const minuteNumber = Number(minutes)
  const secondNumber = Number(seconds)
  if (hourNumber > 23 || minuteNumber > 59 || secondNumber > 59) {
    return null
  }

  return `${hours}:${minutes}:${seconds}`
}

const getCurrentISODate = () => new Date().toISOString().slice(0, 10)
const getDatePartFromDueDateTime = (dueDate) => {
  const match = String(dueDate).match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : ''
}

const addDaysToISODate = (isoDate, daysToAdd) => {
  const date = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) {
    return isoDate
  }

  date.setUTCDate(date.getUTCDate() + daysToAdd)
  return date.toISOString().slice(0, 10)
}

const getTaskRetentionCutoffDate = () => {
  return addDaysToISODate(getCurrentISODate(), -TASK_RETENTION_DAYS)
}

const splitByRetention = (tasks) => {
  if (!shouldDeleteOldTasks) {
    return { keptTasks: tasks, removedTasks: [] }
  }

  const cutoffDate = getTaskRetentionCutoffDate()
  const keptTasks = []
  const removedTasks = []

  for (const task of tasks) {
    if (getDatePartFromDueDateTime(task.dueDate) < cutoffDate) {
      removedTasks.push(task)
      continue
    }
    keptTasks.push(task)
  }

  return { keptTasks, removedTasks }
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
    dueEndTime: parseClockTime(typeof task.dueEndTime === 'string' ? task.dueEndTime : '') || null,
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

const prunePersistedOldTasks = async (tasks) => {
  const { keptTasks, removedTasks } = splitByRetention(tasks)
  if (removedTasks.length) {
    await db.tasks.bulkDelete(removedTasks.map((task) => task.id))
  }
  return keptTasks
}

const readSettings = async () => {
  const rows = await db.settings.toArray()
  const map = rows.reduce((acc, row) => {
    acc[row.id] = row.value
    return acc
  }, {})

  return {
    timezone: typeof map[SETTINGS_KEYS.timezone] === 'string' ? map[SETTINGS_KEYS.timezone] : null,
    language: typeof map[SETTINGS_KEYS.language] === 'string' ? map[SETTINGS_KEYS.language] : null,
    syncEnabled: Boolean(map[SETTINGS_KEYS.syncEnabled]),
  }
}

const writeSettings = async (settings) => {
  await db.settings.bulkPut([
    { id: SETTINGS_KEYS.timezone, value: settings.timezone || null },
    { id: SETTINGS_KEYS.language, value: settings.language || null },
    { id: SETTINGS_KEYS.syncEnabled, value: Boolean(settings.syncEnabled) },
  ])
}

const migrateFromLegacy = async () => {
  const legacyTasks = readLegacyTasks()
  const legacyTimezone = readLegacyTimezone()
  const hasPersistedTasks = (await db.tasks.count()) > 0

  // Only hydrate from legacy localStorage on a true first migration.
  if (!hasPersistedTasks && legacyTasks.length) {
    await upsertTasks(legacyTasks)
  }

  const hasPersistedTimezone = Boolean((await db.settings.get(SETTINGS_KEYS.timezone))?.value)
  if (!hasPersistedTimezone && legacyTimezone) {
    await db.settings.put({ id: SETTINGS_KEYS.timezone, value: legacyTimezone })
  }

  safeLocalStorageRemove(LEGACY_TASKS_KEY)
  safeLocalStorageRemove(LEGACY_TIMEZONE_KEY)
}

export const taskStorage = {
  async initialize(defaultTimeZone) {
    try {
      await migrateFromLegacy()
      const tasks = await prunePersistedOldTasks(await readDexieTasks())
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
          language: null,
          syncEnabled: false,
        },
        fallbackActive: false,
      }
    }
  },

  async saveTask(task) {
    const normalizedTask = normalizeTask(task)
    if (!normalizedTask) {
      return
    }

    const { keptTasks } = splitByRetention([normalizedTask])
    if (!keptTasks.length) {
      await db.tasks.delete(normalizedTask.id)
      return
    }

    await db.tasks.put(normalizedTask)
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
    const merged = mergeTasks(normalizedLocal, normalizedRemote, onEqualTimestamp)
    return splitByRetention(merged).keptTasks
  },

  async replaceAllTasks(tasks) {
    const normalizedTasks = splitByRetention(tasks.map(normalizeTask).filter(Boolean)).keptTasks
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
  allDayTime: ALL_DAY_SENTINEL_TIME,
  recurringValues: RECURRING_VALUES,
}
