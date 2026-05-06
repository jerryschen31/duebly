import { taskModel } from '../storage'

export const SNAPSHOT_VERSION = 1

const normalizeSettings = (settings) => {
  if (!settings || typeof settings !== 'object') {
    return { timezone: null }
  }

  return {
    timezone: typeof settings.timezone === 'string' && settings.timezone ? settings.timezone : null,
  }
}

const normalizeTasks = (tasks) => {
  if (!Array.isArray(tasks)) {
    return []
  }

  return tasks.map(taskModel.normalizeTask).filter(Boolean)
}

export const normalizeSnapshot = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const version = Number.isFinite(payload.version) ? Math.trunc(payload.version) : null
  if (version !== SNAPSHOT_VERSION) {
    return null
  }

  return {
    version: SNAPSHOT_VERSION,
    updatedAt:
      typeof payload.updatedAt === 'string' && !Number.isNaN(Date.parse(payload.updatedAt))
        ? payload.updatedAt
        : null,
    tasks: normalizeTasks(payload.tasks),
    settings: normalizeSettings(payload.settings),
    metadata:
      payload.metadata && typeof payload.metadata === 'object'
        ? payload.metadata
        : {
          source: 'duebly-web',
          schema: 'task-snapshot-v1',
        },
  }
}

export const createSnapshot = ({ tasks, settings }) => {
  return {
    version: SNAPSHOT_VERSION,
    updatedAt: new Date().toISOString(),
    tasks: normalizeTasks(tasks),
    settings: normalizeSettings(settings),
    metadata: {
      source: 'duebly-web',
      schema: 'task-snapshot-v1',
    },
  }
}
