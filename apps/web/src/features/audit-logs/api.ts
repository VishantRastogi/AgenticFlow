import type { AuditEvent } from "@/mocks/audit-store"
import type { AuditQuery } from "@/features/audit-logs/query"
import { operationsRequest } from "@/features/operations/request"

const messages = {
  network: "The audit service could not be reached.",
  unavailable: "The real audit API is unavailable. Mock mode was not used.",
}

export type AuditResponse = {
  simulated: true
  asOf: string
  events: AuditEvent[]
  actors: string[]
  resources: string[]
  total: number
}

export function getAuditLogs(query: AuditQuery) {
  const search = new URLSearchParams(query)
  return operationsRequest<AuditResponse>(`/api/audit-logs?${search.toString()}`, "GET", messages)
}
