import type { AuditEvent } from "@/mocks/audit-store"
import type { AuditQuery } from "@/features/audit-logs/query"
import { operationsRequest } from "@/features/operations/request"

export type AuditResponse = {
  simulated: true
  asOf: string
  events: AuditEvent[]
  actors: string[]
  resources: string[]
  total: number
}

export function getAuditLogs(query: AuditQuery) {
  return operationsRequest<AuditResponse>("audit.list", { query })
}
