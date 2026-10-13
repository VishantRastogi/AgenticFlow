import type { Metadata } from "next"
import { AuditLogsScreen } from "@/features/audit-logs/audit-logs-screen"

export const metadata: Metadata = { title: "Audit Logs" }

export default function AuditLogsPage() {
  return <AuditLogsScreen />
}
