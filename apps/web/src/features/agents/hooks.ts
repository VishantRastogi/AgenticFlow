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
import {
  getAgentStudio,
  listAgentTestRuns,
  listAgentTools,
  publishAgentStudio,
  rollbackAgentStudio,
  saveAgentStudio,
  testAgentStudio,
} from "@/features/agents/studio-api"
import type { AgentConfiguration, AgentPublishRequest, AgentRollbackRequest, AgentTestRequest } from "@/features/agents/studio-types"
import type { AgentDetail, AgentListParams, AgentWriteInput } from "@/features/agents/types"
import { localWorkspace } from "@/lib/workspace"

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

export function useAgentStudio(agentId: string) {
  return useQuery({
    queryKey: [...agentKeys.detail(agentId), "studio", localWorkspace.id],
    queryFn: () => getAgentStudio(localWorkspace.id, agentId),
  })
}

export function useAgentTools() {
  return useQuery({
    queryKey: ["agents", "tools", localWorkspace.id],
    queryFn: () => listAgentTools(localWorkspace.id),
  })
}

function refreshStudio(client: ReturnType<typeof useQueryClient>, agentId: string) {
  return client.invalidateQueries({ queryKey: [...agentKeys.detail(agentId), "studio"] })
}

export function useSaveAgentStudio(agentId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (draft: AgentConfiguration) => saveAgentStudio(localWorkspace.id, agentId, draft),
    onSuccess: () => refreshStudio(client, agentId),
  })
}

export function usePublishAgentStudio(agentId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<AgentPublishRequest, "workspaceId">) =>
      publishAgentStudio(agentId, { ...input, workspaceId: localWorkspace.id }),
    onSuccess: () => refreshAgents(client).then(() => refreshStudio(client, agentId)),
  })
}

export function useRollbackAgentStudio(agentId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<AgentRollbackRequest, "workspaceId">) =>
      rollbackAgentStudio(agentId, { ...input, workspaceId: localWorkspace.id }),
    onSuccess: () => refreshStudio(client, agentId),
  })
}

export function useAgentTestRuns(agentId: string) {
  return useQuery({
    queryKey: [...agentKeys.detail(agentId), "studio", "runs", localWorkspace.id],
    queryFn: () => listAgentTestRuns(localWorkspace.id, agentId),
  })
}

export function useTestAgentStudio(agentId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<AgentTestRequest, "workspaceId"> & { signal?: AbortSignal }) => {
      const { signal, ...body } = input
      return testAgentStudio(agentId, { ...body, workspaceId: localWorkspace.id }, signal)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: [...agentKeys.detail(agentId), "studio", "runs"] }),
  })
}

export function useTriggerExecution(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => triggerAgentExecution(id),
    onSuccess: () => refreshAgents(client),
  })
}
