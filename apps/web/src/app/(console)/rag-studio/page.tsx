import type { Metadata } from "next"
import { RagStudioScreen } from "@/features/rag/rag-screen"

export const metadata: Metadata = { title: "RAG Studio" }

export default function RagStudioPage() {
  return <RagStudioScreen />
}
