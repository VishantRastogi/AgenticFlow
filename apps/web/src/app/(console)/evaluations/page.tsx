import type { Metadata } from "next"
import { ModuleScreen } from "@/components/shared/module-screen"

export const metadata: Metadata = { title: "Evaluations" }

export default function EvaluationsPage() {
  return <ModuleScreen moduleKey="evaluations" />
}