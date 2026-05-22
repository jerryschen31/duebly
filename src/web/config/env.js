const parseBooleanFlag = (value, defaultValue = false) => {
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

const getString = (key) => {
  const value = import.meta.env[key]
  return typeof value === 'string' ? value.trim() : ''
}

const getStringFromKeys = (...keys) => {
  for (const key of keys) {
    const value = getString(key)
    if (value) {
      return value
    }
  }
  return ''
}

const kindeDomain = getStringFromKeys('DUEBLY_KINDE_DOMAIN', 'VITE_KINDE_DOMAIN') || 'https://duebly.kinde.com'
const kindeClientId = getStringFromKeys('DUEBLY_KINDE_CLIENT_ID', 'VITE_KINDE_CLIENT_ID')
const kindeRedirectUri = getStringFromKeys('DUEBLY_KINDE_REDIRECT_URI', 'VITE_KINDE_REDIRECT_URI')
const kindeLogoutUri = getStringFromKeys('DUEBLY_KINDE_LOGOUT_URI', 'VITE_KINDE_LOGOUT_URI')
const kindeScope = getStringFromKeys('DUEBLY_KINDE_SCOPE', 'VITE_KINDE_SCOPE') || 'openid profile email offline'
const kindeAudience = getStringFromKeys('DUEBLY_KINDE_AUDIENCE', 'VITE_KINDE_AUDIENCE') || ''
const hasKindeConfig = Boolean(kindeDomain && kindeClientId && kindeRedirectUri && kindeLogoutUri)

const apiBaseUrl = (getStringFromKeys('DUEBLY_API_BASE_URL', 'VITE_API_BASE_URL') || 'https://api.duebly.app').replace(/\/+$/, '')
const syncEnabled = parseBooleanFlag(getString('DUEBLY_SYNC_ENABLED'), true)
const discardGuestTasks = parseBooleanFlag(getString('DISCARD_GUEST_TASKS'), true)
const appVersion = getString('DUEBLY_APP_VERSION') || 'v0.0.0'

export const appConfig = {
  authEnabled: parseBooleanFlag(getStringFromKeys('DUEBLY_AUTH_ENABLED', 'VITE_AUTH_ENABLED'), hasKindeConfig),
  kinde: {
    domain: kindeDomain,
    clientId: kindeClientId,
    redirectUri: kindeRedirectUri,
    logoutUri: kindeLogoutUri,
    scope: kindeScope,
    audience: kindeAudience,
    configured: hasKindeConfig,
  },
  sync: {
    enabled: syncEnabled,
    apiBaseUrl,
    discardGuestTasks,
  },
  app: {
    version: appVersion,
  },
}
