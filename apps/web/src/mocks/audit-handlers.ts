import { http, HttpResponse } from "msw"
import type { ApiErrorBody } from "@/features/auth/types"
import { isAuditQuery, queryAudit } from "@/features/audit-logs/query"
import { listAuditEvents } from "@/mocks/audit-store"
import { SIMULATED_NOW } from "@/mocks/fixtures/operations"

function error(status: number, body: ApiErrorBody) {
  return HttpResponse.json(body, { status })
}

export const auditHandlers = [
  http.get("*/api/audit-logs", ({ request }) => {
    const url = new URL(request.url)
    const query = {
      q: url.searchParams.get("q") ?? "",
      actor: url.searchParams.get("actor") ?? "all",
      resource: url.searchParams.get("resource") ?? "all",
      outcome: url.searchParams.get("outcome") ?? "all",
      range: url.searchParams.get("range") ?? "all",
    }
    if (!isAuditQuery(query)) {
      return error(400, { code: "validation_error", message: "Audit filters are not supported." })
    }
    return HttpResponse.json({ simulated: true, asOf: SIMULATED_NOW, ...queryAudit(listAuditEvents(), query, SIMULATED_NOW) })
  }),
]
