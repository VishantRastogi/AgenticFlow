import type { Metadata } from "next"
import { KnowledgeLibraryScreen } from "@/features/knowledge/library-screen"

export const metadata: Metadata = { title: "Knowledge Bases" }

export default function KnowledgeBasesPage() {
  return <KnowledgeLibraryScreen />
}
