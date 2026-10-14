import type { Metadata } from "next"
import { AgentDetailScreen } from "@/features/agents/components/agent-detail-screen"

export const metadata: Metadata = { title: "Agent" }

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AgentDetailScreen agentId={id} />
}
