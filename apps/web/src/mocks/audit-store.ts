import { SIMULATED_NOW } from "@/mocks/fixtures/operations"
import { operationsFixture } from "@/mocks/fixtures/operations"
import { readMockSession } from "@/mocks/store"

const STORAGE_KEY = "agentflow-mock-audit"

export type AuditOutcome = "succeeded" | "failed"
export type AuditEvent = {
  id: string
  at: string
  actor: string
  action: string
  resourceType: string
  resourceId: string
  outcome: AuditOutcome
  detail: string
  fields: Record<string, string>
}

type Overlay = { sequence: number; events: AuditEvent[] }

const SENSITIVE = /(password|token|secret|apikey|api_key|authorization|credential)/i

export function maskSecret(value: string) {
  if (value.length <= 4) return "••••"
  return `${value.slice(0, 2)}••••${value.slice(-2)}`
}

export function maskFields(input: Record<string, unknown>) {
  const fields: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue
    const text = typeof value === "string" ? value : JSON.stringify(value)
    fields[key] = SENSITIVE.test(key) ? maskSecret(text) : text
  }
  return fields
}

function emptyOverlay(): Overlay {
  return { sequence: 0, events: [] }
}

function readOverlay(): Overlay {
  if (typeof localStorage === "undefined") return emptyOverlay()
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return emptyOverlay()
  try {
    const parsed = JSON.parse(raw) as Partial<Overlay>
    if (!parsed || !Array.isArray(parsed.events) || typeof parsed.sequence !== "number") return emptyOverlay()
    return { sequence: parsed.sequence, events: parsed.events }
  } catch {
    return emptyOverlay()
  }
}

function writeOverlay(overlay: Overlay) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay))
}

export function auditActor(request: Request) {
  const header = request.headers.get("authorization") ?? ""
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null
  const session = readMockSession(token)
  if (!session || session.expired) return "Workspace"
  return session.user.name
}

export function recordAudit(input: Omit<AuditEvent, "id" | "at" | "fields"> & { fields?: Record<string, unknown> }) {
  const overlay = readOverlay()
  overlay.sequence += 1
  const event: AuditEvent = {
    id: `aud_${overlay.sequence}`,
    at: SIMULATED_NOW,
    actor: input.actor,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    outcome: input.outcome,
    detail: input.detail,
    fields: maskFields(input.fields ?? {}),
  }
  overlay.events.unshift(event)
  writeOverlay(overlay)
  return event
}

function seedEvents(): AuditEvent[] {
  return operationsFixture.agents.map((agent) => ({
    id: `aud_seed_${agent.id}`,
    at: agent.updatedAt ?? SIMULATED_NOW,
    actor: "Workspace seed",
    action: "agent.registered",
    resourceType: "agent",
    resourceId: agent.id,
    outcome: "succeeded" as const,
    detail: `${agent.name} is part of the workspace record.`,
    fields: { environment: agent.environment, version: agent.version ?? "" },
  }))
}

export function listAuditEvents() {
  return [...readOverlay().events, ...seedEvents()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id.localeCompare(a.id))
}
