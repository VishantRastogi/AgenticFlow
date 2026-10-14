import type { AnalyticsQuery, AnalyticsSnapshot } from "@/features/analytics/types"
import { operationsRequest } from "@/features/operations/request"

const messages = {
  network: "The analytics service could not be reached.",
  unavailable: "The real analytics API is unavailable. Mock mode was not used.",
}

export function getAnalytics(query: AnalyticsQuery) {
  const search = new URLSearchParams({ environment: query.environment, range: query.range })
  return operationsRequest<AnalyticsSnapshot>(`/api/analytics?${search.toString()}`, "GET", messages)
}
