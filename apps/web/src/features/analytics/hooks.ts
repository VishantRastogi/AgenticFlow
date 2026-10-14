"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { getAnalytics } from "@/features/analytics/api"
import type { AnalyticsQuery } from "@/features/analytics/types"

export function useAnalytics(query: AnalyticsQuery) {
  return useQuery({
    queryKey: ["analytics", query.environment, query.range],
    queryFn: () => getAnalytics(query),
    placeholderData: keepPreviousData,
  })
}
