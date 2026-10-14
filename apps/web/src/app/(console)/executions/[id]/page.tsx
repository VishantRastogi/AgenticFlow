import type { Metadata } from "next"
import { ExecutionDetailScreen } from "@/features/executions/components/execution-detail"

export const metadata: Metadata = { title: "Execution" }

export default async function ExecutionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ExecutionDetailScreen executionId={id} />
}
