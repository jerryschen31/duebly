import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const createKindeClientMock = vi.fn()

vi.mock('@kinde-oss/kinde-auth-pkce-js', () => ({
  default: createKindeClientMock,
}))

beforeEach(() => {
  createKindeClientMock.mockReset()
  createKindeClientMock.mockResolvedValue({
    isAuthenticated: vi.fn().mockResolvedValue(false),
    getUserProfile: vi.fn().mockResolvedValue(null),
  })
  vi.stubEnv('DUEBLY_KINDE_DOMAIN', 'https://duebly.kinde.com')
  vi.stubEnv('DUEBLY_KINDE_CLIENT_ID', 'cid')
  vi.stubEnv('DUEBLY_KINDE_REDIRECT_URI', 'https://duebly.app')
  vi.stubEnv('DUEBLY_KINDE_LOGOUT_URI', 'https://duebly.app')
  vi.stubEnv('DUEBLY_AUTH_ENABLED', 'true')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('kindeAuth audience config', () => {
  it('passes audience to createKindeClient when configured', async () => {
    vi.stubEnv('DUEBLY_KINDE_AUDIENCE', 'https://api.duebly.app')
    const { getKindeClient } = await import('./kindeAuth.js')

    await getKindeClient()

    expect(createKindeClientMock).toHaveBeenCalledTimes(1)
    expect(createKindeClientMock.mock.calls[0][0]).toMatchObject({
      audience: 'https://api.duebly.app',
    })
  })

  it('omits audience option when not configured', async () => {
    const { getKindeClient } = await import('./kindeAuth.js')

    await getKindeClient()

    expect(createKindeClientMock).toHaveBeenCalledTimes(1)
    expect(createKindeClientMock.mock.calls[0][0].audience).toBeUndefined()
  })
})

describe('getAccessToken', () => {
  it('returns access token when SDK token response is an object', async () => {
    createKindeClientMock.mockResolvedValue({
      getToken: vi.fn().mockResolvedValue({ access_token: 'acc-123' }),
    })
    const { getAccessToken } = await import('./kindeAuth.js')

    await expect(getAccessToken()).resolves.toBe('acc-123')
  })

  it('does not fall back to id token when access token is unavailable', async () => {
    createKindeClientMock.mockResolvedValue({
      getToken: vi.fn().mockResolvedValue({ id_token: 'id-123' }),
      getIdToken: vi.fn().mockResolvedValue('id-123'),
    })
    const { getAccessToken } = await import('./kindeAuth.js')

    await expect(getAccessToken()).resolves.toBeNull()
  })
})
