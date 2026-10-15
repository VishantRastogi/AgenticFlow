import type { Metadata } from "next"
import { KnowledgeDocumentScreen } from "@/features/knowledge/document-screen"

export const metadata: Metadata = { title: "Document" }

export default async function KnowledgeDocumentPage({
  params,
}: {
  params: Promise<{ id: string; documentId: string }>
}) {
  const { id, documentId } = await params
  return <KnowledgeDocumentScreen knowledgeBaseId={id} documentId={documentId} />
}
