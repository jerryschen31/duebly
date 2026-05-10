import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('appConfig.kinde audience', () => {
  it('defaults audience to empty string when not configured', async () => {
    vi.stubEnv('DUEBLY_KINDE_DOMAIN', 'https://duebly.kinde.com')
    vi.stubEnv('DUEBLY_KINDE_CLIENT_ID', 'cid')
    vi.stubEnv('DUEBLY_KINDE_REDIRECT_URI', 'https://duebly.app')
    vi.stubEnv('DUEBLY_KINDE_LOGOUT_URI', 'https://duebly.app')

    const { appConfig } = await import('./env.js')
    expect(appConfig.kinde.audience).toBe('')
  })

  it('reads DUEBLY_KINDE_AUDIENCE when provided', async () => {
    vi.stubEnv('DUEBLY_KINDE_DOMAIN', 'https://duebly.kinde.com')
    vi.stubEnv('DUEBLY_KINDE_CLIENT_ID', 'cid')
    vi.stubEnv('DUEBLY_KINDE_REDIRECT_URI', 'https://duebly.app')
    vi.stubEnv('DUEBLY_KINDE_LOGOUT_URI', 'https://duebly.app')
    vi.stubEnv('DUEBLY_KINDE_AUDIENCE', 'https://api.duebly.app')

    const { appConfig } = await import('./env.js')
    expect(appConfig.kinde.audience).toBe('https://api.duebly.app')
  })
})

describe('appConfig.sync.discardGuestTasks', () => {
  it('defaults DISCARD_GUEST_TASKS to true', async () => {
    const { appConfig } = await import('./env.js')
    expect(appConfig.sync.discardGuestTasks).toBe(true)
  })

  it('reads DISCARD_GUEST_TASKS=false when provided', async () => {
    vi.stubEnv('DISCARD_GUEST_TASKS', 'false')

    const { appConfig } = await import('./env.js')
    expect(appConfig.sync.discardGuestTasks).toBe(false)
  })
})
