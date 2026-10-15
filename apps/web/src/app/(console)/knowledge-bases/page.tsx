import type { Metadata } from "next"
import { ModuleScreen } from "@/components/shared/module-screen"

export const metadata: Metadata = { title: "Knowledge Bases" }

export default function KnowledgeBasesPage() {
  return <ModuleScreen moduleKey="knowledge-bases" />
}
