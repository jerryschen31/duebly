import Dexie from 'dexie'

const LEGACY_TASKS_KEY = 'duedly.tasks.v1'
const LEGACY_TIMEZONE_KEY = 'duedly.timezone.v1'
const MIGRATION_META_KEY = 'duedly.dexie.migration.v1'

const SETTINGS_KEYS = {
  timezone: 'timezone',
  syncEnabled: 'sync-enabled',
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

const safeLocalStorageSet = (key, value) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore storage failures
  }
}

const readMigrationMeta = () => {
  const raw = safeLocalStorageGet(MIGRATION_META_KEY)
  if (!raw) {
    return {
      migrated: false,
      stableLaunches: 0,
    }
  }

  try {
    const parsed = JSON.parse(raw)
    return {
      migrated: Boolean(parsed.migrated),
      stableLaunches: Number.isFinite(parsed.stableLaunches)
        ? Math.max(0, Math.min(2, parsed.stableLaunches))
        : 0,
    }
  } catch {
    return {
      migrated: false,
      stableLaunches: 0,
    }
  }
}

const writeMigrationMeta = (meta) => {
  safeLocalStorageSet(MIGRATION_META_KEY, JSON.stringify(meta))
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
  const lastUpdated = Number.isNaN(Date.parse(lastUpdatedCandidate || ''))
    ? getNowIso()
    : lastUpdatedCandidate

  return {
    id: String(task.id),
    text: String(task.text),
    dueDate,
    isDone: Boolean(task.isDone),
    color,
    createdAt: Number.isFinite(task.createdAt) ? task.createdAt : getNow(),
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

const writeLegacyBackup = (tasks, settings) => {
  safeLocalStorageSet(LEGACY_TASKS_KEY, JSON.stringify(tasks))
  if (settings.timezone) {
    safeLocalStorageSet(LEGACY_TIMEZONE_KEY, settings.timezone)
  }
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
  }
}

const writeSettings = async (settings) => {
  await db.settings.bulkPut([
    { id: SETTINGS_KEYS.timezone, value: settings.timezone || null },
    { id: SETTINGS_KEYS.syncEnabled, value: Boolean(settings.syncEnabled) },
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

  const meta = readMigrationMeta()
  writeMigrationMeta({
    migrated: true,
    stableLaunches: meta.stableLaunches,
  })
}

export const taskStorage = {
  async initialize(defaultTimeZone) {
    const existingMeta = readMigrationMeta()

    if (!existingMeta.migrated) {
      await migrateFromLegacy()
    }

    let tasks = []
    let settings = { timezone: null, syncEnabled: false }
    let dexieReady

    try {
      tasks = await readDexieTasks()
      settings = await readSettings()
      dexieReady = true
    } catch {
      dexieReady = false
    }

    const previousLaunches = existingMeta.stableLaunches
    const stableLaunches = dexieReady ? Math.min(previousLaunches + 1, 2) : 0

    writeMigrationMeta({
      migrated: true,
      stableLaunches,
    })

    const fallbackActive = stableLaunches < 2

    if (fallbackActive) {
      const legacyTasks = readLegacyTasks()
      if (legacyTasks.length) {
        tasks = mergeTasks(tasks, legacyTasks)
        if (dexieReady) {
          await upsertTasks(tasks)
        }
      }

      if (!settings.timezone) {
        settings.timezone = readLegacyTimezone() || defaultTimeZone
        if (dexieReady) {
          await writeSettings(settings)
        }
      }
    }

    if (!settings.timezone) {
      settings.timezone = defaultTimeZone
      if (dexieReady) {
        await writeSettings(settings)
      }
    }

    return {
      tasks,
      settings,
      fallbackActive,
    }
  },

  async saveTask(task, mirrorLegacy) {
    await db.tasks.put(normalizeTask(task))

    if (mirrorLegacy) {
      const tasks = await readDexieTasks()
      const settings = await readSettings()
      writeLegacyBackup(tasks, settings)
    }
  },

  async deleteTask(taskId, mirrorLegacy) {
    await db.tasks.delete(taskId)

    if (mirrorLegacy) {
      const tasks = await readDexieTasks()
      const settings = await readSettings()
      writeLegacyBackup(tasks, settings)
    }
  },

  async saveSettings(settings, mirrorLegacy) {
    await writeSettings(settings)

    if (mirrorLegacy) {
      const tasks = await readDexieTasks()
      writeLegacyBackup(tasks, settings)
    }
  },

  mergeForSync(localTasks, remoteTasks, onEqualTimestamp) {
    const normalizedLocal = localTasks.map(normalizeTask).filter(Boolean)
    const normalizedRemote = remoteTasks.map(normalizeTask).filter(Boolean)
    return mergeTasks(normalizedLocal, normalizedRemote, onEqualTimestamp)
  },

  async replaceAllTasks(tasks, mirrorLegacy) {
    const normalizedTasks = tasks.map(normalizeTask).filter(Boolean)
    await db.transaction('rw', db.tasks, async () => {
      await db.tasks.clear()
      if (normalizedTasks.length) {
        await db.tasks.bulkPut(normalizedTasks)
      }
    })

    if (mirrorLegacy) {
      const settings = await readSettings()
      writeLegacyBackup(normalizedTasks, settings)
    }
  },
}

export const taskModel = {
  normalizeTask,
  getNowIso,
  getNow,
  recurringValues: RECURRING_VALUES,
}
