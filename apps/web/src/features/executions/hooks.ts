"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { isApiError } from "@/features/auth/api/errors"
import { cancelExecution, getExecution, listExecutions, retryExecution, tickExecution } from "@/features/executions/api"
import { createPollingFeed } from "@/features/executions/feed"
import type { ExecutionListParams } from "@/features/executions/types"
import { isTerminalStatus } from "@/features/executions/types"

export const executionKeys = {
  all: ["executions"] as const,
  list: (params: ExecutionListParams) => ["executions", "list", params] as const,
  detail: (id: string) => ["executions", "detail", id] as const,
}

function refreshShared(client: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    client.invalidateQueries({ queryKey: executionKeys.all }),
    client.invalidateQueries({ queryKey: ["dashboard"] }),
    client.invalidateQueries({ queryKey: ["agents"] }),
  ])
}

export function useExecutionList(params: ExecutionListParams) {
  return useQuery({
    queryKey: executionKeys.list(params),
    queryFn: () => listExecutions(params),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => {
      if (process.env.VITEST === "true") return false
      const rows = query.state.data?.executions ?? []
      return rows.some((execution) => !isTerminalStatus(execution.status)) ? 2000 : false
    },
  })
}

export function useExecution(id: string) {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: executionKeys.detail(id),
    queryFn: () => getExecution(id),
  })
  const [liveError, setLiveError] = useState<string | null>(null)
  const watchLive = Boolean(query.data && !isTerminalStatus(query.data.execution.status) && process.env.VITEST !== "true")

  useEffect(() => {
    if (!watchLive) return
    const feed = createPollingFeed({
      poll: () => tickExecution(id),
      intervalMs: 1200,
      isTerminal: (result) => isTerminalStatus(result.execution.status),
    })
    return feed.start(
      (result) => {
        client.setQueryData(executionKeys.detail(id), result)
        void client.invalidateQueries({ queryKey: ["executions", "list"] })
        void client.invalidateQueries({ queryKey: ["dashboard"] })
        void client.invalidateQueries({ queryKey: ["agents"] })
      },
      (error) => {
        setLiveError(isApiError(error) ? error.message : "The execution service could not be reached.")
      },
    )
  }, [client, id, watchLive])

  return { ...query, liveError }
}

export function useCancelExecution(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => cancelExecution(id),
    onSuccess: (result) => {
      client.setQueryData(executionKeys.detail(id), result)
      return refreshShared(client)
    },
  })
}

export function useRetryExecution(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => retryExecution(id),
    onSuccess: () => refreshShared(client),
  })
}

