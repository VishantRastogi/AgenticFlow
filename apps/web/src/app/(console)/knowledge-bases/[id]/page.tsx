import type { Metadata } from "next"
import { KnowledgeDetailScreen } from "@/features/knowledge/detail-screen"

export const metadata: Metadata = { title: "Knowledge base" }

export default async function KnowledgeBasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <KnowledgeDetailScreen knowledgeBaseId={id} />
}
