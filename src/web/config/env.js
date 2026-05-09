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

const kindeDomain = getString('DUEBLY_KINDE_DOMAIN') || 'https://duebly.kinde.com'
const kindeClientId = getString('DUEBLY_KINDE_CLIENT_ID')
const kindeRedirectUri = getString('DUEBLY_KINDE_REDIRECT_URI')
const kindeLogoutUri = getString('DUEBLY_KINDE_LOGOUT_URI')
const kindeScope = getString('DUEBLY_KINDE_SCOPE') || 'openid profile email offline'
const hasKindeConfig = Boolean(kindeDomain && kindeClientId && kindeRedirectUri && kindeLogoutUri)

export const appConfig = {
  authEnabled: parseBooleanFlag(getString('DUEBLY_AUTH_ENABLED'), hasKindeConfig),
  kinde: {
    domain: kindeDomain,
    clientId: kindeClientId,
    redirectUri: kindeRedirectUri,
    logoutUri: kindeLogoutUri,
    scope: kindeScope,
    configured: hasKindeConfig,
  },
}
