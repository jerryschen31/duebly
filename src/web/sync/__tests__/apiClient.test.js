// Tests for the sync API client. Verifies request shape, header
// construction, error mapping, and graceful handling of empty remote
// state per AC-1.

import { describe, it, expect, vi } from 'vitest'
import { createSyncApiClient, SyncApiError, buildEnvelope, __test__ } from '../apiClient.js'

const { SCHEMA_VERSION, TASKS_PATH } = __test__

const fakeFetchOk = (body, status = 200) => {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    async json() { return body },
  })
}

const fakeFetchStatus = (status, body = null) => {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    async json() { return body },
  })
}

describe('createSyncApiClient', () => {
  it('throws when configured without a base URL', () => {
    expect(() => createSyncApiClient({ getAccessToken: async () => 't', fetchImpl: fakeFetchOk({}) }))
      .toThrow(SyncApiError)
  })

  it('GET /v1/tasks sends the bearer token and parses the envelope', async () => {
    const fetchImpl = fakeFetchOk({ schema_version: 1, updated_at: '2030-01-01T00:00:00Z', tasks: [{ id: 'a' }] })
    const client = createSyncApiClient({
      baseUrl: 'https://api.example.com',
      getAccessToken: async () => 'tok-123',
      fetchImpl,
    })

    const envelope = await client.pullTasks()

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(`https://api.example.com${TASKS_PATH}`)
    expect(init.method).toBe('GET')
    expect(init.headers.Authorization).toBe('Bearer tok-123')
    expect(envelope.schema_version).toBe(1)
    expect(envelope.tasks).toEqual([{ id: 'a' }])
  })

  it('GET treats 404 as "no remote object yet" with an empty envelope', async () => {
    const fetchImpl = fakeFetchStatus(404)
    const client = createSyncApiClient({
      baseUrl: 'https://api.example.com',
      getAccessToken: async () => 'tok',
      fetchImpl,
    })
    const envelope = await client.pullTasks()
    expect(envelope.tasks).toEqual([])
    expect(envelope.schema_version).toBe(SCHEMA_VERSION)
  })

  it('GET surfaces 401/403 as a SyncApiError with code "auth"', async () => {
    const fetchImpl = fakeFetchStatus(401)
    const client = createSyncApiClient({
      baseUrl: 'https://api.example.com',
      getAccessToken: async () => 'tok',
      fetchImpl,
    })
    await expect(client.pullTasks()).rejects.toMatchObject({
      name: 'SyncApiError',
      status: 401,
      code: 'auth',
    })
  })

  it('PUT /v1/tasks sends the merged envelope as JSON with Content-Type', async () => {
    const fetchImpl = fakeFetchOk({ ok: true, schema_version: 1, updated_at: '2030-01-01', task_count: 1 })
    const client = createSyncApiClient({
      baseUrl: 'https://api.example.com/',
      getAccessToken: async () => 'tok-xyz',
      fetchImpl,
    })

    const tasks = [
      { id: 'a', text: 'x', last_updated: '2030-01-01T00:00:00Z', deleted: false },
      { id: 'b', last_updated: '2030-01-01T00:00:00Z', deleted: true },
      { id: 'no-ts' /* missing last_updated -> dropped */ },
      'not an object',
    ]
    const result = await client.pushTasks(tasks)

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(`https://api.example.com${TASKS_PATH}`)
    expect(init.method).toBe('PUT')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.headers.Authorization).toBe('Bearer tok-xyz')

    const sent = JSON.parse(init.body)
    expect(sent.schema_version).toBe(1)
    expect(typeof sent.updated_at).toBe('string')
    expect(sent.tasks.map((t) => t.id)).toEqual(['a', 'b'])
    expect(sent.tasks[1].deleted).toBe(true)

    expect(result.ok).toBe(true)
  })

  it('PUT surfaces 413 with code "too_large"', async () => {
    const client = createSyncApiClient({
      baseUrl: 'https://api.example.com',
      getAccessToken: async () => 'tok',
      fetchImpl: fakeFetchStatus(413),
    })
    await expect(client.pushTasks([{ id: 'a', last_updated: '2030-01-01' }]))
      .rejects.toMatchObject({ code: 'too_large' })
  })

  it('rejects with code "auth" when no token is available', async () => {
    const client = createSyncApiClient({
      baseUrl: 'https://api.example.com',
      getAccessToken: async () => null,
      fetchImpl: fakeFetchOk({}),
    })
    await expect(client.pullTasks()).rejects.toMatchObject({ code: 'auth' })
  })

  it('maps fetch network failures to code "network"', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const client = createSyncApiClient({
      baseUrl: 'https://api.example.com',
      getAccessToken: async () => 'tok',
      fetchImpl,
    })
    await expect(client.pullTasks()).rejects.toMatchObject({ code: 'network' })
  })
})

describe('buildEnvelope', () => {
  it('produces a versioned envelope with sanitized tasks', () => {
    const env = buildEnvelope([{ id: 1, last_updated: '2030-01-01', text: 'a', deleted: undefined }])
    expect(env.schema_version).toBe(SCHEMA_VERSION)
    expect(env.tasks[0].id).toBe('1')
    expect(env.tasks[0].deleted).toBe(false)
    expect('deleted' in env.tasks[0]).toBe(true)
    // No undefined values should sneak in.
    for (const value of Object.values(env.tasks[0])) {
      expect(value).not.toBeUndefined()
    }
  })
})
