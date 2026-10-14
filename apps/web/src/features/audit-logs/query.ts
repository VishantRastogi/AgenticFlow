import type { AuditEvent, AuditOutcome } from "@/mocks/audit-store"
import { SIMULATED_NOW } from "@/mocks/fixtures/operations"

export type AuditQuery = {
  q: string
  actor: string
  resource: string
  outcome: "all" | AuditOutcome
  range: "all" | "24h" | "7d" | "30d"
}

const RANGES = new Set<AuditQuery["range"]>(["all", "24h", "7d", "30d"])
const OUTCOMES = new Set<AuditQuery["outcome"]>(["all", "succeeded", "failed"])

export function isAuditQuery(value: { outcome: string; range: string }): value is Pick<AuditQuery, "outcome" | "range"> {
  return OUTCOMES.has(value.outcome as AuditQuery["outcome"]) && RANGES.has(value.range as AuditQuery["range"])
}

export function queryAudit(events: AuditEvent[], query: AuditQuery, asOf = SIMULATED_NOW) {
  const asOfMs = Date.parse(asOf)
  const windowMs = query.range === "24h" ? 86_400_000 : query.range === "7d" ? 7 * 86_400_000 : query.range === "30d" ? 30 * 86_400_000 : null
  const needle = query.q.trim().toLowerCase()
  const matches = events.filter((event) => {
    const started = Date.parse(event.at)
    const inWindow = windowMs === null || (started >= asOfMs - windowMs && started <= asOfMs)
    const actor = query.actor === "all" || event.actor === query.actor
    const resource = query.resource === "all" || event.resourceType === query.resource
    const outcome = query.outcome === "all" || event.outcome === query.outcome
    const text =
      needle.length === 0 ||
      event.action.toLowerCase().includes(needle) ||
      event.actor.toLowerCase().includes(needle) ||
      event.resourceId.toLowerCase().includes(needle) ||
      event.detail.toLowerCase().includes(needle)
    return inWindow && actor && resource && outcome && text
  })
  return {
    events: matches,
    actors: [...new Set(events.map((event) => event.actor))].sort(),
    resources: [...new Set(events.map((event) => event.resourceType))].sort(),
    total: matches.length,
  }
}
