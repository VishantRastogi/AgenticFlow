import type { AuthUser } from "@/features/auth/types"

/**
 * Development-only mock identity store.
 * Passwords and sessions are plain browser data. This is not authentication.
 * Components must not import this module. Requests go through the auth API client,
 * and these records are read only by the MSW handlers.
 */

const STORAGE_KEY = "agentflow-mock-auth"
const SESSION_MS = 8 * 60 * 60 * 1000
const RESET_MS = 30 * 60 * 1000

export const MOCK_NETWORK_EMAIL = "network@agentflow.test"

type MockUser = AuthUser & {
  password: string
}

type MockSessionRecord = {
  token: string
  userId: string
  expiresAt: string
}

type MockResetRecord = {
  token: string
  email: string
  expiresAt: string
}

type MockDatabase = {
  users: MockUser[]
  sessions: MockSessionRecord[]
  resets: MockResetRecord[]
}

const seedUser: MockUser = {
  id: "user_ada",
  name: "Ada Lovelace",
  email: "ada@agentflow.test",
  password: "orbit-7481",
}

function emptyDatabase(): MockDatabase {
  return {
    users: [{ ...seedUser }],
    sessions: [],
    resets: [],
  }
}

function readDatabase(): MockDatabase {
  if (typeof localStorage === "undefined") {
    return emptyDatabase()
  }

  const raw = localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    const seeded = emptyDatabase()
    writeDatabase(seeded)
    return seeded
  }

  try {
    const parsed = JSON.parse(raw) as MockDatabase
    if (!Array.isArray(parsed.users) || !Array.isArray(parsed.sessions) || !Array.isArray(parsed.resets)) {
      const seeded = emptyDatabase()
      writeDatabase(seeded)
      return seeded
    }
    return parsed
  } catch {
    const seeded = emptyDatabase()
    writeDatabase(seeded)
    return seeded
  }
}

function writeDatabase(database: MockDatabase) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(database))
}

function update(mutator: (database: MockDatabase) => void) {
  const database = readDatabase()
  mutator(database)
  writeDatabase(database)
  return database
}

function token(prefix: string) {
  return `${prefix}.${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 8)}`
}

function publicUser(user: MockUser): AuthUser {
  return { id: user.id, name: user.name, email: user.email }
}

export function findMockUser(email: string) {
  return readDatabase().users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null
}

export function createMockSession(user: MockUser, expiresAt = new Date(Date.now() + SESSION_MS).toISOString()) {
  const session = {
    token: `mock.${user.id}.${token("session")}`,
    expiresAt,
    user: publicUser(user),
  }

  update((database) => {
    database.sessions.push({
      token: session.token,
      userId: user.id,
      expiresAt: session.expiresAt,
    })
  })

  return session
}

export function readMockSession(authToken: string | null) {
  if (!authToken) {
    return null
  }

  const database = readDatabase()
  const record = database.sessions.find((session) => session.token === authToken)

  if (!record) {
    return null
  }

  const user = database.users.find((item) => item.id === record.userId)

  if (!user) {
    return null
  }

  return {
    token: record.token,
    expiresAt: record.expiresAt,
    user: publicUser(user),
    expired: Date.parse(record.expiresAt) <= Date.now(),
  }
}

export function deleteMockSession(authToken: string | null) {
  if (!authToken) {
    return
  }

  update((database) => {
    database.sessions = database.sessions.filter((session) => session.token !== authToken)
  })
}

export function expireMockSession(authToken: string) {
  update((database) => {
    const record = database.sessions.find((session) => session.token === authToken)
    if (record) {
      record.expiresAt = new Date(Date.now() - 60_000).toISOString()
    }
  })
}

export function registerMockUser(input: { name: string; email: string; password: string }) {
  const existing = findMockUser(input.email)

  if (existing) {
    return null
  }

  const user: MockUser = {
    id: token("user"),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
  }

  update((database) => {
    database.users.push(user)
  })

  return user
}

export function updateMockPassword(email: string, password: string) {
  update((database) => {
    const user = database.users.find((item) => item.email.toLowerCase() === email.toLowerCase())
    if (user) {
      user.password = password
    }
  })
}

export function createMockReset(email: string) {
  const reset = {
    token: token("reset"),
    email: email.toLowerCase(),
    expiresAt: new Date(Date.now() + RESET_MS).toISOString(),
  }

  update((database) => {
    database.resets = database.resets.filter((item) => item.email !== reset.email)
    database.resets.push(reset)
  })

  return reset
}

export function consumeMockReset(resetToken: string) {
  const database = readDatabase()
  const reset = database.resets.find((item) => item.token === resetToken)

  if (!reset || Date.parse(reset.expiresAt) <= Date.now()) {
    return null
  }

  update((current) => {
    current.resets = current.resets.filter((item) => item.token !== resetToken)
  })

  return reset
}

export function readMockHint() {
  const user = findMockUser(seedUser.email)

  if (!user) {
    return null
  }

  return {
    name: user.name,
    email: user.email,
    password: user.password,
    notice: "This mock account is stored in the browser in plain text. It is not a secure session.",
  }
}
