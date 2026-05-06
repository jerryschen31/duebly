const parseBoolean = (value, fallback = false) => {
  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return fallback
}

const parseInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

const readEnv = (name, legacyName) => {
  const primary = import.meta.env[name]
  if (typeof primary === 'string' && primary.trim()) {
    return primary.trim()
  }

  const legacy = legacyName ? import.meta.env[legacyName] : undefined
  if (typeof legacy === 'string' && legacy.trim()) {
    return legacy.trim()
  }

  return ''
}

const authEnabled = parseBoolean(readEnv('DUEBLY_AUTH_ENABLED', 'VITE_AUTH_ENABLED'), false)
const remoteSyncEnabled = parseBoolean(
  readEnv('DUEBLY_DRIVE_SYNC_ENABLED', 'VITE_DRIVE_SYNC_ENABLED'),
  false,
)

const kinde = {
  domain: readEnv('DUEBLY_KINDE_DOMAIN'),
  clientId: readEnv('DUEBLY_KINDE_CLIENT_ID'),
  redirectUri: readEnv('DUEBLY_KINDE_REDIRECT_URI'),
  logoutUri: readEnv('DUEBLY_KINDE_LOGOUT_URI'),
}

const kindeRequired = ['domain', 'clientId', 'redirectUri', 'logoutUri']
const missingKindeConfig = kindeRequired.filter((key) => !kinde[key])

export const appEnv = {
  authEnabled,
  remoteSyncEnabled,
  driveAppDataFilename: readEnv('DUEBLY_DRIVE_APPDATA_FILENAME') || 'duebly_backup.json',
  syncPushDebounceMs: parseInteger(readEnv('DUEBLY_SYNC_PUSH_DEBOUNCE_MS'), 3000),
  kinde,
  kindeRequiredSatisfied: missingKindeConfig.length === 0,
  missingKindeConfig,
}

export const getAuthScope = () => {
  return 'openid profile email offline https://www.googleapis.com/auth/drive.appdata'
}
