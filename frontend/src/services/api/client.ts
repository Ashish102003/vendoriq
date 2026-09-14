import {
  AUTH_UNAUTHORIZED_EVENT,
  clearAccessToken,
  getAccessToken,
} from '../auth/token'

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? 'http://localhost:8000' : '')

export class ApiError extends Error {
  override name: string = 'ApiError'
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

const FRIENDLY_ERROR_MESSAGES: Record<number, string> = {
  401: 'Your session has expired. Please sign in again.',
  404: 'The requested resource could not be found.',
  500: 'An unexpected server error occurred. Please try again.',
}

const REQUEST_TIMEOUT_MS = 30000
const TIMEOUT_MESSAGE = 'The request is taking too long. Please try again.'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: HeadersInit
}

interface InFlightEntry {
  promise: Promise<unknown>
}

const inFlight = new Map<string, InFlightEntry>()

function cacheKey(method: string, path: string): string {
  return `${method} ${path}`
}

function isAbortError(error: unknown): boolean {
  return (
    typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    error.name === 'AbortError'
  )
}

async function safeErrorBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function resolveErrorMessage(body: unknown): string {
  if (body === null || typeof body !== 'object') return 'Request failed'
  const detail = (body as { detail?: unknown }).detail
  if (typeof detail === 'string' && detail.length > 0) return detail
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (item && typeof item === 'object') {
          const msg = (item as { msg?: unknown }).msg
          return typeof msg === 'string' ? msg : ''
        }
        return ''
      })
      .filter((text) => text.length > 0)
    if (messages.length > 0) return messages.join(' ')
  }
  return 'Request failed'
}

async function executeRequest<T>(
  path: string,
  options: RequestOptions,
  method: string,
): Promise<T> {
  const { body, headers } = options
  const token = getAccessToken()
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    if (!response.ok) {
      if (response.status === 401) {
        clearAccessToken()
        window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT))
      }
      let message = resolveErrorMessage(await safeErrorBody(response))
      if (message === 'Request failed') {
        message =
          FRIENDLY_ERROR_MESSAGES[response.status as number] ?? message
      }
      throw new ApiError(message, response.status)
    }

    return (await response.json()) as T
  } catch (error) {
    if (isAbortError(error)) {
      throw new ApiError(TIMEOUT_MESSAGE)
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const key = cacheKey(method, path)

  if (method === 'GET') {
    const existing = inFlight.get(key)
    if (existing) {
      return existing.promise as Promise<T>
    }
    const promise = executeRequest<T>(path, options, method)
    const entry: InFlightEntry = { promise }
    inFlight.set(key, entry)
    promise.finally(() => {
      if (inFlight.get(key) === entry) {
        inFlight.delete(key)
      }
    }).catch(() => {})
    return promise
  }

  return executeRequest<T>(path, options, method)
}