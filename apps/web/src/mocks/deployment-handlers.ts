import { http, HttpResponse } from "msw"
import type { ApiErrorBody } from "@/features/auth/types"
import { auditActor, recordAudit } from "@/mocks/audit-store"
import { deployEnvironment, deploymentSnapshot, listDeploymentSnapshots, requireDeploymentEnvironment, rollbackEnvironment } from "@/mocks/deployment-store"

function error(status: number, body: ApiErrorBody) {
  return HttpResponse.json(body, { status })
}

export const deploymentHandlers = [
  http.get("*/api/deployments", () => HttpResponse.json({ simulated: true, environments: listDeploymentSnapshots() })),

  http.get("*/api/deployments/:id", ({ params }) => {
    const environment = requireDeploymentEnvironment(String(params.id))
    if (!environment) return error(404, { code: "unknown", message: "This environment is not a deployment target." })
    return HttpResponse.json(deploymentSnapshot(environment))
  }),

  http.post("*/api/deployments/:id/deploy", ({ params, request }) => {
    const environment = requireDeploymentEnvironment(String(params.id))
    if (!environment) return error(404, { code: "unknown", message: "This environment is not a deployment target." })
    const result = deployEnvironment(environment)
    recordAudit({
      actor: auditActor(request),
      action: result.release.status === "failed" ? "deployment.health_failed" : "deployment.activated",
      resourceType: "deployment",
      resourceId: result.release.id,
      outcome: result.release.status === "failed" ? "failed" : "succeeded",
      detail: result.release.note,
      fields: { environment, version: result.release.version },
    })
    return HttpResponse.json(result, { status: result.release.status === "failed" ? 200 : 201 })
  }),

  http.post("*/api/deployments/:id/rollback", ({ params, request }) => {
    const environment = requireDeploymentEnvironment(String(params.id))
    if (!environment) return error(404, { code: "unknown", message: "This environment is not a deployment target." })
    const result = rollbackEnvironment(environment)
    if ("error" in result) return error(409, { code: "validation_error", message: result.reason })
    recordAudit({
      actor: auditActor(request),
      action: "deployment.rolled_back",
      resourceType: "deployment",
      resourceId: result.release.id,
      outcome: "succeeded",
      detail: result.release.note,
      fields: { environment, version: result.release.version },
    })
    return HttpResponse.json(result)
  }),
]
