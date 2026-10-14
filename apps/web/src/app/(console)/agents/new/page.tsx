import type { Metadata } from "next"
import { NewAgentScreen } from "@/features/agents/components/new-agent-screen"

export const metadata: Metadata = { title: "New agent" }

export default function NewAgentPage() {
  return <NewAgentScreen />
}
