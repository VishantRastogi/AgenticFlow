"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createAgent,
  deleteAgent,
  getAgent,
  listAgents,
  setAgentActive,
  triggerAgentExecution,
  updateAgent,
} from "@/features/agents/api"
import type { AgentDetail, AgentListParams, AgentWriteInput } from "@/features/agents/types"

export const agentKeys = {
  all: ["agents"] as const,
  list: (params: AgentListParams) => ["agents", "list", params] as const,
  detail: (id: string) => ["agents", "detail", id] as const,
}

export function useAgentList(params: AgentListParams) {
  return useQuery({
    queryKey: agentKeys.list(params),
    queryFn: () => listAgents(params),
    placeholderData: keepPreviousData,
  })
}

export function useAgent(id: string) {
  return useQuery({
    queryKey: agentKeys.detail(id),
    queryFn: () => getAgent(id),
  })
}

function refreshAgents(client: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    client.invalidateQueries({ queryKey: agentKeys.all }),
    client.invalidateQueries({ queryKey: ["dashboard"] }),
  ])
}

export function useCreateAgentRecord() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: AgentWriteInput) => createAgent(input),
    onSuccess: () => refreshAgents(client),
  })
}

export function useUpdateAgent(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: AgentWriteInput) => updateAgent(id, input),
    onSuccess: () => refreshAgents(client),
  })
}

export function useDeleteAgent(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => deleteAgent(id),
    onSuccess: () => refreshAgents(client),
  })
}

export function useSetAgentActive(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (active: boolean) => setAgentActive(id, active),
    onMutate: async (active) => {
      await client.cancelQueries({ queryKey: agentKeys.detail(id) })
      const previous = client.getQueryData<AgentDetail>(agentKeys.detail(id))
      if (previous) {
        client.setQueryData<AgentDetail>(agentKeys.detail(id), {
          ...previous,
          agent: { ...previous.agent, status: active ? "active" : "paused" },
        })
      }
      return { previous }
    },
    onError: (_error, _active, context) => {
      if (context?.previous) client.setQueryData(agentKeys.detail(id), context.previous)
    },
    onSettled: () => refreshAgents(client),
  })
}

export function useTriggerExecution(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => triggerAgentExecution(id),
    onSuccess: () => refreshAgents(client),
  })
}
