"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createAgent, getDashboard } from "@/features/dashboard/api"
import type { CreateAgentInput, DashboardQuery } from "@/features/dashboard/types"

export const dashboardKeys = {
  all: ["dashboard"] as const,
  view: (query: DashboardQuery) => ["dashboard", query.environment, query.range] as const,
}

export function useDashboard(query: DashboardQuery) {
  return useQuery({
    queryKey: dashboardKeys.view(query),
    queryFn: () => getDashboard(query),
    placeholderData: keepPreviousData,
  })
}

export function useCreateAgent() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateAgentInput) => createAgent(input),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: dashboardKeys.all }),
        client.invalidateQueries({ queryKey: ["agents"] }),
      ])
    },
  })
}
