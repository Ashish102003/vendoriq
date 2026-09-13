export const TOKEN_STORAGE_KEY = 'vendoriq_access_token'

export const AUTH_UNAUTHORIZED_EVENT = 'vendoriq:unauthorized'

export function getAccessToken(): string | null {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setAccessToken(token: string): void {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function clearAccessToken(): void {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY)
}