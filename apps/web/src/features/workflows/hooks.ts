"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createWorkflow,
  deleteWorkflow,
  getWorkflow,
  listWorkflows,
  publishWorkflow,
  startWorkflowRun,
  updateWorkflow,
} from "@/features/workflows/api"
import type { WorkflowListParams, WorkflowWriteInput } from "@/features/workflows/types"

export const workflowKeys = {
  all: ["workflows"] as const,
  list: (params: WorkflowListParams) => ["workflows", "list", params] as const,
  detail: (id: string) => ["workflows", "detail", id] as const,
}

function refreshWorkflows(client: ReturnType<typeof useQueryClient>) {
  return client.invalidateQueries({ queryKey: workflowKeys.all })
}

export function useWorkflowList(params: WorkflowListParams) {
  return useQuery({
    queryKey: workflowKeys.list(params),
    queryFn: () => listWorkflows(params),
    placeholderData: keepPreviousData,
  })
}

export function useWorkflow(id: string | null) {
  return useQuery({
    queryKey: workflowKeys.detail(id ?? "new"),
    queryFn: () => getWorkflow(id ?? ""),
    enabled: Boolean(id),
  })
}

export function useCreateWorkflow() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: WorkflowWriteInput) => createWorkflow(input),
    onSuccess: () => refreshWorkflows(client),
  })
}

export function useUpdateWorkflow(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<WorkflowWriteInput> & { status?: "draft" }) => updateWorkflow(id, input),
    onSuccess: () => refreshWorkflows(client),
  })
}

export function useDeleteWorkflow(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => deleteWorkflow(id),
    onSuccess: () => refreshWorkflows(client),
  })
}

export function usePublishWorkflow(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => publishWorkflow(id),
    onSuccess: () => refreshWorkflows(client),
  })
}

export function useStartWorkflowRun(id: string) {
  return useMutation({
    mutationFn: () => startWorkflowRun(id),
  })
}
