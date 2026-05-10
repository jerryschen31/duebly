// Frontend API client for the private Cloudflare Worker that brokers
// access to Cloudflare R2. The backend contract is documented in
// remote-storage-implementation.md §5 and remote-store-implementation-AC.md.
//
// Endpoints:
//   GET  /v1/tasks  -> returns versioned envelope { schema_version, updated_at, tasks }
//   PUT  /v1/tasks  -> persists full snapshot for the authenticated user
//
// Both endpoints require `Authorization: Bearer <kinde_access_token>`.

const SCHEMA_VERSION = 1
const TASKS_PATH = '/v1/tasks'

export class SyncApiError extends Error {
  constructor(message, { status = 0, code = 'unknown' } = {}) {
    super(message)
    this.name = 'SyncApiError'
    this.status = status
    this.code = code
  }
}

const ensureValidBaseUrl = (baseUrl) => {
  if (typeof baseUrl !== 'string' || !baseUrl) {
    throw new SyncApiError('Sync API base URL is not configured', { code: 'config' })
  }
  return baseUrl.replace(/\/+$/, '')
}

const isAbortError = (error) => {
  return Boolean(error) && (error.name === 'AbortError' || error.code === 20)
}

const buildHeaders = (token, extra = {}) => {
  const headers = { Accept: 'application/json', ...extra }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

const sanitizeTaskForRemote = (task) => {
  if (!task || typeof task !== 'object') {
    return null
  }
  if (!task.id || !task.last_updated) {
    return null
  }
  // Strip undefined values so the JSON payload is deterministic.
  const cleaned = {}
  for (const [key, value] of Object.entries(task)) {
    if (value === undefined) {
      continue
    }
    cleaned[key] = value
  }
  cleaned.id = String(task.id)
  cleaned.last_updated = String(task.last_updated)
  cleaned.deleted = Boolean(task.deleted)
  return cleaned
}

export const buildEnvelope = (tasks) => {
  const sanitized = (tasks || []).map(sanitizeTaskForRemote).filter(Boolean)
  return {
    schema_version: SCHEMA_VERSION,
    updated_at: new Date().toISOString(),
    tasks: sanitized,
  }
}

const parseEnvelope = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return { schema_version: SCHEMA_VERSION, updated_at: null, tasks: [] }
  }
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : []
  return {
    schema_version: Number.isFinite(payload.schema_version) ? payload.schema_version : SCHEMA_VERSION,
    updated_at: typeof payload.updated_at === 'string' ? payload.updated_at : null,
    tasks,
  }
}

const readJsonOrNull = async (response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export const createSyncApiClient = ({
  baseUrl,
  getAccessToken,
  fetchImpl = (typeof fetch === 'function' ? fetch.bind(globalThis) : null),
} = {}) => {
  if (typeof fetchImpl !== 'function') {
    throw new SyncApiError('No fetch implementation available', { code: 'config' })
  }
  const resolvedBaseUrl = ensureValidBaseUrl(baseUrl)

  const requireToken = async () => {
    if (typeof getAccessToken !== 'function') {
      throw new SyncApiError('No access token provider configured', { code: 'auth' })
    }
    const token = await getAccessToken()
    if (!token || typeof token !== 'string') {
      throw new SyncApiError('No access token available for sync', { code: 'auth' })
    }
    return token
  }

  const performRequest = async (path, init, { signal } = {}) => {
    let response
    try {
      response = await fetchImpl(`${resolvedBaseUrl}${path}`, { ...init, signal })
    } catch (error) {
      if (isAbortError(error)) {
        throw error
      }
      throw new SyncApiError('Network error contacting sync API', { code: 'network' })
    }

    if (response.status === 401 || response.status === 403) {
      throw new SyncApiError('Sync request was not authorized', {
        status: response.status,
        code: 'auth',
      })
    }
    if (response.status === 413) {
      throw new SyncApiError('Sync payload exceeded server limits', {
        status: response.status,
        code: 'too_large',
      })
    }
    if (response.status === 422 || response.status === 400) {
      throw new SyncApiError('Sync payload was rejected by server', {
        status: response.status,
        code: 'invalid',
      })
    }
    if (!response.ok) {
      throw new SyncApiError(`Sync API responded with status ${response.status}`, {
        status: response.status,
        code: 'server',
      })
    }
    return response
  }

  return {
    async pullTasks({ signal } = {}) {
      const token = await requireToken()
      let response
      try {
        response = await performRequest(TASKS_PATH, {
          method: 'GET',
          headers: buildHeaders(token),
        }, { signal })
      } catch (error) {
        if (error instanceof SyncApiError && error.status === 404) {
          return { schema_version: SCHEMA_VERSION, updated_at: null, tasks: [] }
        }
        throw error
      }
      const payload = await readJsonOrNull(response)
      return parseEnvelope(payload)
    },

    async pushTasks(tasks, { signal } = {}) {
      const token = await requireToken()
      const envelope = buildEnvelope(tasks)
      const response = await performRequest(TASKS_PATH, {
        method: 'PUT',
        headers: buildHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(envelope),
      }, { signal })
      const payload = await readJsonOrNull(response)
      return payload || { ok: true, schema_version: SCHEMA_VERSION, task_count: envelope.tasks.length }
    },
  }
}

export const __test__ = { sanitizeTaskForRemote, parseEnvelope, SCHEMA_VERSION, TASKS_PATH }
