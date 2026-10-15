import type { Metadata } from "next"
import { ModuleScreen } from "@/components/shared/module-screen"

export const metadata: Metadata = { title: "RAG Studio" }

export default function RagStudioPage() {
  return <ModuleScreen moduleKey="rag-studio" />
}
