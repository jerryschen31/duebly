import Dexie from 'dexie'

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

const GUEST_DB_NAME = 'duebly-guest-db'
const GUEST_PROFILE = { type: 'guest' }
let db = null
let activeProfileKey = null

const configureDb = (database) => {
  database.version(1).stores({
    tasks: '&id, dueDate, isDone, createdAt, completedAt, recurring, last_updated',
    settings: '&id',
  })
  database.version(2).stores({
    tasks: '&id, dueDate, dueEndTime, isDone, createdAt, completedAt, recurring, last_updated',
    settings: '&id',
  })
  return database
}

// Obfuscates opaque auth identifiers for DB naming. This is non-cryptographic and
// only intended to avoid exposing raw user identifiers in browser storage names.
const hashProfileId = (value) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

const getProfileKey = (profile) => {
  if (!profile || profile.type !== 'user') {
    return 'guest'
  }

  const userId = String(profile.id || '').trim()
  if (!userId) {
    throw new Error('Authenticated profile is missing a stable user id')
  }
  return `user-${hashProfileId(userId)}`
}

const getDatabaseName = (profileKey) => {
  if (profileKey === 'guest') {
    return GUEST_DB_NAME
  }

  return `duebly-${profileKey}-db`
}

const getDb = () => {
  if (!db) {
    db = configureDb(new Dexie(GUEST_DB_NAME))
    activeProfileKey = 'guest'
  }
  return db
}

const getNow = () => Date.now()
const getNowIso = () => new Date().toISOString()

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
  const tasks = await getDb().tasks.toArray()
  return tasks.map(normalizeTask).filter(Boolean)
}

const prunePersistedOldTasks = async (tasks) => {
  const { keptTasks, removedTasks } = splitByRetention(tasks)
  if (removedTasks.length) {
    await getDb().tasks.bulkDelete(removedTasks.map((task) => task.id))
  }
  return keptTasks
}

const readSettings = async () => {
  const rows = await getDb().settings.toArray()
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
  await getDb().settings.bulkPut([
    { id: SETTINGS_KEYS.timezone, value: settings.timezone || null },
    { id: SETTINGS_KEYS.language, value: settings.language || null },
    { id: SETTINGS_KEYS.syncEnabled, value: Boolean(settings.syncEnabled) },
  ])
}

const setActiveProfile = (profile) => {
  const nextProfileKey = getProfileKey(profile)
  if (db && activeProfileKey === nextProfileKey) {
    return
  }

  if (db) {
    db.close()
  }

  activeProfileKey = nextProfileKey
  db = configureDb(new Dexie(getDatabaseName(nextProfileKey)))
}

export const taskStorage = {
  async initialize(defaultTimeZone, profile = GUEST_PROFILE) {
    try {
      setActiveProfile(profile)
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
      await getDb().tasks.delete(normalizedTask.id)
      return
    }

    await getDb().tasks.put(normalizedTask)
  },

  async deleteTask(taskId) {
    await getDb().tasks.delete(taskId)
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
    await getDb().transaction('rw', getDb().tasks, async () => {
      await getDb().tasks.clear()
      if (normalizedTasks.length) {
        await getDb().tasks.bulkPut(normalizedTasks)
      }
    })
  },

  async exportSnapshot() {
    return {
      profileKey: activeProfileKey || 'guest',
      tasks: await readDexieTasks(),
      settings: await readSettings(),
    }
  },

  async importSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
      return
    }

    await this.replaceAllTasks(Array.isArray(snapshot.tasks) ? snapshot.tasks : [])
    if (snapshot.settings && typeof snapshot.settings === 'object') {
      await writeSettings(snapshot.settings)
    }
  },
}

export const taskModel = {
  normalizeTask,
  getNowIso,
  getNow,
  allDayTime: ALL_DAY_SENTINEL_TIME,
  recurringValues: RECURRING_VALUES,
}
