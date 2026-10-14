import { http, HttpResponse } from "msw"
import type { ApiErrorBody } from "@/features/auth/types"
import { deriveAnalytics, isAnalyticsQuery } from "@/features/analytics/derive"
import { SIMULATED_NOW } from "@/mocks/fixtures/operations"
import { listAgents, listExecutions } from "@/mocks/operations-store"

function error(status: number, body: ApiErrorBody) {
  return HttpResponse.json(body, { status })
}

export const analyticsHandlers = [
  http.get("*/api/analytics", ({ request }) => {
    const url = new URL(request.url)
    const query = {
      environment: url.searchParams.get("environment") ?? "",
      range: url.searchParams.get("range") ?? "",
    }
    if (!isAnalyticsQuery(query)) {
      return error(400, { code: "validation_error", message: "Environment or date range is not supported." })
    }
    return HttpResponse.json(
      deriveAnalytics({ agents: listAgents(), executions: listExecutions(), asOf: SIMULATED_NOW }, query),
    )
  }),
]
