import type { Metadata } from "next"
import { WorkflowEditor } from "@/features/workflows/components/workflow-editor"

export const metadata: Metadata = { title: "New workflow" }

export default function NewWorkflowPage() {
  return <WorkflowEditor />
}
