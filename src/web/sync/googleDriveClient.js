import { appEnv } from '../config/env'
import { createSnapshot, normalizeSnapshot } from './snapshot'

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3'

const wait = (ms) => new Promise((resolve) => {
  window.setTimeout(resolve, ms)
})

const buildMultipartBody = (snapshot) => {
  const boundary = `duebly-${Math.random().toString(16).slice(2)}`
  const metadata = {
    name: appEnv.driveAppDataFilename,
    parents: ['appDataFolder'],
    mimeType: 'application/json',
  }

  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(snapshot)}\r\n` +
    `--${boundary}--`

  return {
    body,
    contentType: `multipart/related; boundary=${boundary}`,
  }
}

export const createGoogleDriveClient = ({ getAccessToken }) => {
  let appDataFileId = null

  const requestWithRetry = async (url, init = {}, options = {}) => {
    const {
      allowRefresh = true,
      retries = 2,
      rawResponse = false,
      expectedStatuses = [200],
    } = options

    let token = await getAccessToken({ forceRefresh: false })
    if (!token) {
      throw new Error('Missing Google access token for Drive API')
    }

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const response = await fetch(url, {
        ...init,
        headers: {
          ...(init.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      })

      if (expectedStatuses.includes(response.status)) {
        if (rawResponse) {
          return response
        }

        if (response.status === 204) {
          return null
        }

        const text = await response.text()
        return text ? JSON.parse(text) : null
      }

      if (response.status === 401 && allowRefresh) {
        token = await getAccessToken({ forceRefresh: true })
        if (!token) {
          throw new Error('Unable to refresh Google access token for Drive API')
        }
        continue
      }

      if (response.status === 429 && attempt < retries) {
        await wait(400 * (attempt + 1))
        continue
      }

      const responseText = await response.text()
      throw new Error(
        `Drive API request failed (${response.status}): ${responseText || response.statusText || 'Unknown error'}`,
      )
    }

    throw new Error('Drive API retry attempts exhausted')
  }

  const getOrCreateAppDataFileId = async () => {
    if (appDataFileId) {
      return appDataFileId
    }

    const list = await requestWithRetry(
      `${DRIVE_API_BASE}/files?spaces=appDataFolder&fields=files(id,name)&pageSize=100`,
      { method: 'GET' },
      { expectedStatuses: [200] },
    )

    const existingFile = Array.isArray(list?.files)
      ? list.files.find((file) => file?.name === appEnv.driveAppDataFilename)
      : null
    if (existingFile?.id) {
      appDataFileId = existingFile.id
      return appDataFileId
    }

    const created = await requestWithRetry(
      `${DRIVE_API_BASE}/files?fields=id`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: appEnv.driveAppDataFilename,
          parents: ['appDataFolder'],
          mimeType: 'application/json',
        }),
      },
      { expectedStatuses: [200] },
    )

    if (!created?.id) {
      throw new Error('Drive API did not return appData file id')
    }

    appDataFileId = created.id
    return appDataFileId
  }

  const downloadSnapshot = async () => {
    const fileId = await getOrCreateAppDataFileId()

    const response = await requestWithRetry(
      `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media`,
      { method: 'GET' },
      { rawResponse: true, expectedStatuses: [200, 404] },
    )

    if (response.status === 404) {
      return null
    }

    const text = await response.text()
    if (!text) {
      return null
    }

    let parsed
    try {
      parsed = JSON.parse(text)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Invalid Drive snapshot JSON payload', error)
      }
      return null
    }

    return normalizeSnapshot(parsed)
  }

  const uploadSnapshot = async ({ tasks, settings }) => {
    const snapshot = createSnapshot({ tasks, settings })
    const fileId = await getOrCreateAppDataFileId()
    const { body, contentType } = buildMultipartBody(snapshot)

    await requestWithRetry(
      `${DRIVE_UPLOAD_API_BASE}/files/${encodeURIComponent(fileId)}?uploadType=multipart`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': contentType,
        },
        body,
      },
      { expectedStatuses: [200] },
    )

    return snapshot
  }

  return {
    getOrCreateAppDataFileId,
    downloadSnapshot,
    uploadSnapshot,
  }
}
