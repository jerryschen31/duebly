// Storage-layer tests covering tombstone (soft-delete) propagation and
// the guest-to-user migration helpers from the storage module. These tests
// run against fake-indexeddb so they exercise Dexie end-to-end.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'

import { taskStorage } from '../storage.js'

const baseTask = (overrides = {}) => ({
  id: overrides.id || 'task-1',
  text: 'Buy milk',
  dueDate: '2030-01-01',
  isDone: false,
  color: '#374151',
  createdAt: 1_700_000_000_000,
  completedAt: null,
  recurring: 'none',
  originalTaskId: null,
  last_updated: '2030-01-01T00:00:00.000Z',
  ...overrides,
})

import Dexie from 'dexie'

beforeEach(async () => {
  // Delete every Dexie database known to the current factory before
  // swapping in a fresh one. Without this, the previous test's data can
  // remain reachable even after the factory is replaced because Dexie
  // caches connection metadata.
  try {
    const names = await Dexie.getDatabaseNames()
    await Promise.all((names || []).map((name) => Dexie.delete(name).catch(() => {})))
  } catch {
    // ignore
  }
  taskStorage.__resetForTests()
  globalThis.indexedDB = new IDBFactory()
})

describe('taskStorage tombstones (soft-delete)', () => {
  it('initializes hide tombstones from the UI but keeps them queryable for sync', async () => {
    await taskStorage.initialize('UTC', { type: 'guest' })
    await taskStorage.saveTask(baseTask({ id: 'live' }))
    await taskStorage.saveTask(baseTask({ id: 'will-delete' }))

    await taskStorage.deleteTask('will-delete')

    // Re-initialize to read fresh state through the UI surface.
    const result = await taskStorage.initialize('UTC', { type: 'guest' })
    expect(result.tasks.map((t) => t.id)).toEqual(['live'])

    const allForSync = await taskStorage.readAllForSync()
    const ids = allForSync.map((t) => t.id).sort()
    expect(ids).toEqual(['live', 'will-delete'])
    const tombstone = allForSync.find((t) => t.id === 'will-delete')
    expect(tombstone.deleted).toBe(true)
    expect(typeof tombstone.last_updated).toBe('string')
  })

  it('persistActiveTasks does not wipe tombstones already in the DB', async () => {
    await taskStorage.initialize('UTC', { type: 'guest' })
    await taskStorage.saveTask(baseTask({ id: 'a' }))
    await taskStorage.saveTask(baseTask({ id: 'b' }))
    await taskStorage.deleteTask('b')

    // Simulate the App-side persistence on every UI mutation: it only
    // knows about the visible tasks, not the tombstone.
    const visibleNow = (await taskStorage.initialize('UTC', { type: 'guest' })).tasks
    await taskStorage.persistActiveTasks(visibleNow)

    const allForSync = await taskStorage.readAllForSync()
    const tombstone = allForSync.find((t) => t.id === 'b')
    expect(tombstone).toBeDefined()
    expect(tombstone.deleted).toBe(true)
  })
})

describe('taskStorage guest-to-user migration', () => {
  it('detects new guest task ids that are not present in the user DB', async () => {
    // Seed guest DB with two tasks.
    await taskStorage.initialize('UTC', { type: 'guest' })
    await taskStorage.saveTask(baseTask({ id: 'shared', text: 'guest version' }))
    await taskStorage.saveTask(baseTask({ id: 'guest-only', text: 'fresh' }))

    // Switch to the authenticated user's DB and seed it with the
    // overlapping id only.
    const userResult = await taskStorage.initialize('UTC', { type: 'user', id: 'user-123' })
    expect(userResult.tasks).toEqual([])
    await taskStorage.saveTask(baseTask({ id: 'shared', text: 'user-side authoritative' }))

    const guestTasks = await taskStorage.readGuestTasks()
    const userTasks = await taskStorage.readAllForSync()
    const importable = taskStorage.computeNewGuestTasks(guestTasks, userTasks)

    expect(importable.map((t) => t.id)).toEqual(['guest-only'])
  })

  it('imports only new guest tasks and does not overwrite existing ids', async () => {
    await taskStorage.initialize('UTC', { type: 'guest' })
    await taskStorage.saveTask(baseTask({ id: 'shared', text: 'guest edit (should be IGNORED)' }))
    await taskStorage.saveTask(baseTask({ id: 'guest-only', text: 'fresh from guest' }))

    await taskStorage.initialize('UTC', { type: 'user', id: 'user-456' })
    await taskStorage.saveTask(baseTask({ id: 'shared', text: 'user authoritative' }))

    const guestTasks = await taskStorage.readGuestTasks()
    const userTasks = await taskStorage.readAllForSync()
    const importable = taskStorage.computeNewGuestTasks(guestTasks, userTasks)
    const imported = await taskStorage.importNewGuestTasks(importable)

    expect(imported.map((t) => t.id)).toEqual(['guest-only'])

    const finalUser = (await taskStorage.initialize('UTC', { type: 'user', id: 'user-456' })).tasks
    const sharedTask = finalUser.find((t) => t.id === 'shared')
    expect(sharedTask.text).toBe('user authoritative')
    const importedTask = finalUser.find((t) => t.id === 'guest-only')
    expect(importedTask.text).toBe('fresh from guest')
  })

  it('discard path leaves authenticated dataset unchanged and wipes guest data', async () => {
    await taskStorage.initialize('UTC', { type: 'guest' })
    await taskStorage.saveTask(baseTask({ id: 'guest-only', text: 'will be discarded' }))

    await taskStorage.initialize('UTC', { type: 'user', id: 'user-789' })
    await taskStorage.saveTask(baseTask({ id: 'user-task', text: 'untouched' }))
    const userBefore = await taskStorage.readAllForSync()

    await taskStorage.wipeGuestData()

    const userAfter = await taskStorage.readAllForSync()
    expect(userAfter.map((t) => t.id).sort()).toEqual(userBefore.map((t) => t.id).sort())

    const guestAfter = await taskStorage.readGuestTasks()
    expect(guestAfter).toEqual([])
  })
})
