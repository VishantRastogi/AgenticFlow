import type { Metadata } from "next"
import { KnowledgeCreateScreen } from "@/features/knowledge/create-screen"

export const metadata: Metadata = { title: "New knowledge base" }

export default function NewKnowledgeBasePage() {
  return <KnowledgeCreateScreen />
}
