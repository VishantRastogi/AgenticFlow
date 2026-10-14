const TOKEN_KEY = "agentflow-auth-token"

// The mock token is a browser-readable stand-in. It is not a secure session.
export function readAuthToken() {
  if (typeof window === "undefined") {
    return null
  }

  return window.localStorage.getItem(TOKEN_KEY)
}

export function writeAuthToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearAuthToken() {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(TOKEN_KEY)
}
