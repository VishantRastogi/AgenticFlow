import type { Metadata } from "next"
import { DeploymentDetailScreen } from "@/features/deployments/components/deployment-detail"

export const metadata: Metadata = { title: "Deployment" }

export default async function DeploymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <DeploymentDetailScreen environmentId={id} />
}
