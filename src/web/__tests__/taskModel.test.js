// Sync-correctness tests for the pure merge helpers exposed on
// `taskModel`. These cover acceptance criteria from
// remote-storage-implementation.md §11 "Sync correctness tests":
//   - Local newer wins.
//   - Remote newer wins.
//   - Equal timestamp tie picks remote.
//   - Tombstone propagation prevents resurrection.

import { describe, it, expect } from 'vitest'
import { taskModel } from '../storage.js'

const baseTask = (overrides = {}) => ({
  id: overrides.id || 't1',
  text: 'Buy milk',
  dueDate: '2030-01-01',
  isDone: false,
  color: '#374151',
  createdAt: 1_700_000_000_000,
  completedAt: null,
  recurring: 'none',
  originalTaskId: null,
  last_updated: '2030-01-01T00:00:00.000Z',
  deleted: false,
  ...overrides,
})

describe('taskModel.mergeForSync', () => {
  it('keeps the local task when local last_updated is newer', () => {
    const local = baseTask({ id: 't1', text: 'local', last_updated: '2030-02-01T00:00:00.000Z' })
    const remote = baseTask({ id: 't1', text: 'remote', last_updated: '2030-01-15T00:00:00.000Z' })
    const merged = taskModel.mergeForSync([local], [remote])
    expect(merged).toHaveLength(1)
    expect(merged[0].text).toBe('local')
  })

  it('keeps the remote task when remote last_updated is newer', () => {
    const local = baseTask({ id: 't1', text: 'local', last_updated: '2030-01-01T00:00:00.000Z' })
    const remote = baseTask({ id: 't1', text: 'remote', last_updated: '2030-02-01T00:00:00.000Z' })
    const merged = taskModel.mergeForSync([local], [remote])
    expect(merged).toHaveLength(1)
    expect(merged[0].text).toBe('remote')
  })

  it('tie-breaks equal last_updated by preferring remote (deterministic)', () => {
    const ts = '2030-01-15T00:00:00.000Z'
    const local = baseTask({ id: 't1', text: 'local', last_updated: ts })
    const remote = baseTask({ id: 't1', text: 'remote', last_updated: ts })
    const conflicts = []
    const merged = taskModel.mergeForSync([local], [remote], (l, r) => conflicts.push({ l, r }))
    expect(merged[0].text).toBe('remote')
    expect(conflicts).toHaveLength(1)
  })

  it('includes tasks that exist only locally or only remotely', () => {
    const local = baseTask({ id: 'only-local' })
    const remote = baseTask({ id: 'only-remote' })
    const merged = taskModel.mergeForSync([local], [remote])
    expect(new Set(merged.map((t) => t.id))).toEqual(new Set(['only-local', 'only-remote']))
  })

  it('propagates tombstones with newer timestamps over older live records', () => {
    const local = baseTask({
      id: 't1',
      text: 'will be deleted',
      last_updated: '2030-01-15T00:00:00.000Z',
    })
    const remote = baseTask({
      id: 't1',
      deleted: true,
      last_updated: '2030-02-01T00:00:00.000Z',
    })
    const merged = taskModel.mergeForSync([local], [remote])
    expect(merged).toHaveLength(1)
    expect(merged[0].deleted).toBe(true)
  })

  it('prevents resurrection when remote still has the live record but local has a newer tombstone', () => {
    const local = baseTask({
      id: 't1',
      deleted: true,
      last_updated: '2030-02-01T00:00:00.000Z',
    })
    const remote = baseTask({
      id: 't1',
      text: 'should not come back',
      last_updated: '2030-01-15T00:00:00.000Z',
    })
    const merged = taskModel.mergeForSync([local], [remote])
    expect(merged).toHaveLength(1)
    expect(merged[0].deleted).toBe(true)
  })

  it('drops tombstones that have exited the retention window', () => {
    // Set last_updated well beyond TOMBSTONE_RETENTION_DAYS so retention pruning
    // permanently removes the record from the merged output.
    const veryOld = baseTask({
      id: 't1',
      deleted: true,
      last_updated: '2000-01-01T00:00:00.000Z',
    })
    expect(taskModel.isExpiredTombstone(veryOld)).toBe(true)
    const merged = taskModel.mergeForSync([veryOld], [])
    expect(merged.find((t) => t.id === 't1')).toBeUndefined()
  })

  it('ignores malformed task records on either side', () => {
    const local = baseTask({ id: 't1' })
    const merged = taskModel.mergeForSync(
      [local, null, { id: 't2' /* missing text/dueDate */ }],
      [{ totally: 'invalid' }],
    )
    expect(merged.map((t) => t.id)).toEqual(['t1'])
  })
})

describe('taskModel.computeNewGuestTasks', () => {
  it('returns only guest tasks whose ids are not present in the user dataset', () => {
    const guestTasks = [
      baseTask({ id: 'shared', text: 'guest version' }),
      baseTask({ id: 'new-from-guest', text: 'fresh guest' }),
    ]
    const userTasks = [baseTask({ id: 'shared', text: 'user version' })]
    const importable = taskModel.computeNewGuestTasks(guestTasks, userTasks)
    expect(importable.map((t) => t.id)).toEqual(['new-from-guest'])
  })

  it('excludes guest-side tombstones (cannot import a delete)', () => {
    const guestTasks = [baseTask({ id: 'g-tomb', deleted: true })]
    const importable = taskModel.computeNewGuestTasks(guestTasks, [])
    expect(importable).toEqual([])
  })

  it('treats an existing user-side tombstone as "already known" and skips re-import', () => {
    const guestTasks = [baseTask({ id: 'shared' })]
    const userTasks = [baseTask({ id: 'shared', deleted: true })]
    const importable = taskModel.computeNewGuestTasks(guestTasks, userTasks)
    expect(importable).toEqual([])
  })
})
