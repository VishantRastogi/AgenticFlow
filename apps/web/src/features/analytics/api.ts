import type { AnalyticsQuery, AnalyticsSnapshot } from "@/features/analytics/types"
import { operationsRequest } from "@/features/operations/request"

export function getAnalytics(query: AnalyticsQuery) {
  return operationsRequest<AnalyticsSnapshot>("analytics.get", {
    query: { environment: query.environment, range: query.range },
  })
}
