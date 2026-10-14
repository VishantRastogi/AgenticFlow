import type { Metadata } from "next"
import { WorkflowEditor } from "@/features/workflows/components/workflow-editor"

export const metadata: Metadata = { title: "Edit workflow" }

export default async function EditWorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <WorkflowEditor workflowId={id} />
}
