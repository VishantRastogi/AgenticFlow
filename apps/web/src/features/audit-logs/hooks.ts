"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { getAuditLogs } from "@/features/audit-logs/api"
import type { AuditQuery } from "@/features/audit-logs/query"

export function useAuditLogs(query: AuditQuery) {
  return useQuery({
    queryKey: ["audit-logs", query],
    queryFn: () => getAuditLogs(query),
    placeholderData: keepPreviousData,
  })
}
