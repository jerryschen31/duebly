// Sync engine tests. Verifies pull-merge-push orchestration, conflict
// resolution behavior with tombstones, debounce/coalescing, periodic
// scheduling, and offline-then-reconnect behavior.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSyncEngine } from '../syncEngine.js'
import { SyncApiError } from '../apiClient.js'

const makeStorage = (initialLocal = []) => {
  const state = {
    local: [...initialLocal],
    replaceCalls: [],
  }
  return {
    state,
    async readAllForSync() { return [...state.local] },
    mergeForSync(local, remote, onEqual) {
      const byId = new Map()
      for (const t of local) {
        byId.set(t.id, t)
      }
      for (const r of remote) {
        const existing = byId.get(r.id)
        if (!existing) {
          byId.set(r.id, r)
          continue
        }
        const lTs = Date.parse(existing.last_updated || '')
        const rTs = Date.parse(r.last_updated || '')
        if (lTs === rTs) {
          if (onEqual) onEqual(existing, r)
          byId.set(r.id, r)
          continue
        }
        if (rTs > lTs) {
          byId.set(r.id, r)
        }
      }
      return [...byId.values()]
    },
    async replaceAllTasks(tasks) {
      state.replaceCalls.push(tasks)
      state.local = [...tasks]
    },
  }
}

const makeApiClient = ({ remote = [], pushSpy } = {}) => {
  const calls = { pull: 0, push: 0, lastPushed: null }
  return {
    calls,
    pullTasks: vi.fn(async () => {
      calls.pull += 1
      return { schema_version: 1, updated_at: '2030-01-01', tasks: [...remote] }
    }),
    pushTasks: vi.fn(async (tasks) => {
      calls.push += 1
      calls.lastPushed = tasks
      if (pushSpy) pushSpy(tasks)
      return { ok: true, schema_version: 1, task_count: tasks.length }
    }),
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createSyncEngine', () => {
  it('fails fast when storage adapter is missing mergeForSync', () => {
    const apiClient = makeApiClient()
    const storage = {
      readAllForSync: vi.fn(async () => []),
      replaceAllTasks: vi.fn(async () => {}),
    }
    expect(() => createSyncEngine({
      apiClient,
      storage,
      isAuthenticated: () => true,
    })).toThrow(/mergeForSync/)
  })

  it('skips sync when not authenticated and does not call the API', async () => {
    const storage = makeStorage()
    const apiClient = makeApiClient()
    const engine = createSyncEngine({
      apiClient,
      storage,
      isAuthenticated: () => false,
    })
    const result = await engine.triggerImmediateSync('startup')
    expect(result.skipped).toBe(true)
    expect(apiClient.pullTasks).not.toHaveBeenCalled()
    expect(apiClient.pushTasks).not.toHaveBeenCalled()
  })

  it('runs pull-merge-push and writes the merged snapshot back to storage', async () => {
    const local = [{ id: 'l-only', last_updated: '2030-02-01T00:00:00Z' }]
    const remote = [{ id: 'r-only', last_updated: '2030-02-01T00:00:00Z' }]
    const storage = makeStorage(local)
    const apiClient = makeApiClient({ remote })
    const engine = createSyncEngine({
      apiClient,
      storage,
      isAuthenticated: () => true,
    })
    const { merged } = await engine.triggerImmediateSync('startup')
    expect(merged.map((t) => t.id).sort()).toEqual(['l-only', 'r-only'])
    expect(storage.state.replaceCalls).toHaveLength(1)
    expect(apiClient.pushTasks).toHaveBeenCalledTimes(1)
    expect(apiClient.calls.lastPushed.map((t) => t.id).sort()).toEqual(['l-only', 'r-only'])
  })

  it('propagates remote tombstones so deletions do not resurrect on reconnect', async () => {
    // Simulates the "offline edits sync correctly on reconnect" path:
    // the remote already saw the delete; the local device comes back with
    // a stale live record; after the cycle the tombstone wins.
    const local = [{ id: 't1', text: 'live', last_updated: '2030-01-01T00:00:00Z' }]
    const remote = [{ id: 't1', deleted: true, last_updated: '2030-02-01T00:00:00Z' }]
    const storage = makeStorage(local)
    const apiClient = makeApiClient({ remote })
    const engine = createSyncEngine({ apiClient, storage, isAuthenticated: () => true })

    const { merged } = await engine.triggerImmediateSync('reconnect')
    const winner = merged.find((t) => t.id === 't1')
    expect(winner.deleted).toBe(true)
  })

  it('debounces rapid mutation triggers into a single sync cycle', async () => {
    const storage = makeStorage()
    const apiClient = makeApiClient()
    const engine = createSyncEngine({
      apiClient,
      storage,
      isAuthenticated: () => true,
      debounceMs: 1000,
      // Disable periodic so it doesn't interfere with timer assertions.
      periodicMs: Number.POSITIVE_INFINITY,
    })
    engine.start()

    engine.triggerDebouncedSync('m1')
    engine.triggerDebouncedSync('m2')
    engine.triggerDebouncedSync('m3')

    expect(apiClient.pullTasks).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    // Flush any queued microtasks created by the engine's awaits.
    await vi.advanceTimersByTimeAsync(0)

    expect(apiClient.pullTasks).toHaveBeenCalledTimes(1)
    expect(apiClient.pushTasks).toHaveBeenCalledTimes(1)
    engine.stop()
  })

  it('coalesces overlapping triggers and runs at most one queued follow-up', async () => {
    const storage = makeStorage()
    let resolvePull
    const apiClient = {
      pullTasks: vi.fn(() => new Promise((res) => { resolvePull = res })),
      pushTasks: vi.fn(async () => ({ ok: true })),
    }
    const engine = createSyncEngine({
      apiClient,
      storage,
      isAuthenticated: () => true,
    })
    const first = engine.triggerImmediateSync('a')
    // Wait a microtask so the first invocation actually starts pulling and
    // assigns `resolvePull` before we queue follow-ups.
    await Promise.resolve()
    // Second and third triggers should collapse into a single queued pass.
    engine.triggerImmediateSync('b').catch(() => {})
    engine.triggerImmediateSync('c').catch(() => {})

    resolvePull({ schema_version: 1, tasks: [] })
    await first
    // Allow the queued follow-up's setTimeout(0) to fire.
    await vi.advanceTimersByTimeAsync(0)
    // The follow-up pull also needs to be resolved.
    if (typeof resolvePull === 'function') {
      resolvePull({ schema_version: 1, tasks: [] })
    }
    await vi.advanceTimersByTimeAsync(0)

    expect(apiClient.pullTasks).toHaveBeenCalledTimes(2)
    expect(apiClient.pushTasks).toHaveBeenCalledTimes(2)
  })

  it('reports auth errors via onError and surfaces an "unauthenticated" status', async () => {
    const storage = makeStorage()
    const apiClient = {
      pullTasks: vi.fn(async () => { throw new SyncApiError('nope', { status: 401, code: 'auth' }) }),
      pushTasks: vi.fn(),
    }
    const statuses = []
    const errors = []
    const engine = createSyncEngine({
      apiClient,
      storage,
      isAuthenticated: () => true,
      onStatusChange: (s) => statuses.push(s.status),
      onError: (err) => errors.push(err),
    })
    await expect(engine.triggerImmediateSync('startup')).rejects.toBeInstanceOf(SyncApiError)
    expect(errors).toHaveLength(1)
    expect(statuses).toContain('unauthenticated')
  })

  it('starts a periodic sync interval when started', async () => {
    const storage = makeStorage()
    const apiClient = makeApiClient()
    const engine = createSyncEngine({
      apiClient,
      storage,
      isAuthenticated: () => true,
      periodicMs: 5000,
    })
    engine.start()

    await vi.advanceTimersByTimeAsync(5000)
    await vi.advanceTimersByTimeAsync(0)
    expect(apiClient.pullTasks.mock.calls.length).toBeGreaterThanOrEqual(1)

    await vi.advanceTimersByTimeAsync(5000)
    await vi.advanceTimersByTimeAsync(0)
    expect(apiClient.pullTasks.mock.calls.length).toBeGreaterThanOrEqual(2)

    engine.stop()
  })

  it('does not start periodic sync when periodicMs is zero', async () => {
    const storage = makeStorage()
    const apiClient = makeApiClient()
    const engine = createSyncEngine({
      apiClient,
      storage,
      isAuthenticated: () => true,
      periodicMs: 0,
    })
    engine.start()

    await vi.advanceTimersByTimeAsync(15_000)
    await vi.advanceTimersByTimeAsync(0)
    expect(apiClient.pullTasks).not.toHaveBeenCalled()
    expect(apiClient.pushTasks).not.toHaveBeenCalled()

    engine.stop()
  })
})
