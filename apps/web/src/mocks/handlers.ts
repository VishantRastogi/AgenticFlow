import { http, HttpResponse } from "msw"
import type { ApiErrorBody, ForgotPasswordInput, LoginInput, RegisterInput, ResetPasswordInput } from "@/features/auth/types"
import { agentStats, isAgentListQuery, logsFor, queryAgents } from "@/features/agents/catalog"
import type { AgentWriteInput } from "@/features/agents/types"
import { deriveDashboard, isDashboardQuery } from "@/features/dashboard/derive"
import type { AgentStatus, AgentType, RetryPolicy, RuntimeEnvironment } from "@/features/dashboard/types"
import { operationsFixture } from "@/mocks/fixtures/operations"
import {
  createStoredAgent,
  deleteStoredAgent,
  listAgents,
  listExecutions,
  triggerStoredExecution,
  updateStoredAgent,
  versionsFor,
} from "@/mocks/operations-store"
import { analyticsHandlers } from "@/mocks/analytics-handlers"
import { auditActor, recordAudit } from "@/mocks/audit-store"
import { auditHandlers } from "@/mocks/audit-handlers"
import { deploymentHandlers } from "@/mocks/deployment-handlers"
import { executionHandlers } from "@/mocks/execution-handlers"
import { agentStudioHandlers } from "@/mocks/agent-studio-handlers"
import { knowledgeHandlers } from "@/mocks/knowledge-handlers"
import { playgroundHandlers } from "@/mocks/playground-handlers"
import { ragHandlers } from "@/mocks/rag-handlers"
import { settingsHandlers } from "@/mocks/settings-handlers"
import { workflowHandlers } from "@/mocks/workflow-handlers"
import {
  MOCK_NETWORK_EMAIL,
  consumeMockReset,
  createMockReset,
  createMockSession,
  deleteMockSession,
  findMockUser,
  readMockHint,
  readMockSession,
  registerMockUser,
  updateMockPassword,
} from "@/mocks/store"

function error(status: number, body: ApiErrorBody) {
  return HttpResponse.json(body, { status })
}

function bearer(request: Request) {
  const header = request.headers.get("authorization")
  if (!header?.toLowerCase().startsWith("bearer ")) {
    return null
  }
  return header.slice(7).trim() || null
}

async function readJson<T>(request: Request) {
  return (await request.json()) as T
}

function isNetwork(email: string | undefined) {
  return email?.toLowerCase() === MOCK_NETWORK_EMAIL
}

export const handlers = [
  http.post("*/api/auth/login", async ({ request }) => {
    const body = await readJson<LoginInput>(request)

    if (isNetwork(body.email)) {
      return HttpResponse.error()
    }

    if (!body.email || !body.password) {
      return error(400, { code: "validation_error", message: "Email and password are required." })
    }

    const user = findMockUser(body.email)

    if (!user || user.password !== body.password) {
      return error(401, { code: "invalid_credentials", message: "Email or password is incorrect." })
    }

    return HttpResponse.json(createMockSession(user))
  }),

  http.post("*/api/auth/register", async ({ request }) => {
    const body = await readJson<RegisterInput>(request)

    if (isNetwork(body.email)) {
      return HttpResponse.error()
    }

    if (!body.name || !body.email || !body.password || body.password.length < 8) {
      return error(400, { code: "validation_error", message: "Name, email, and a password of at least 8 characters are required." })
    }

    const user = registerMockUser(body)

    if (!user) {
      return error(409, { code: "email_taken", message: "An account with this email already exists." })
    }

    return HttpResponse.json(createMockSession(user), { status: 201 })
  }),

  http.post("*/api/auth/logout", ({ request }) => {
    deleteMockSession(bearer(request))
    return new HttpResponse(null, { status: 204 })
  }),

  http.get("*/api/auth/session", ({ request }) => {
    const session = readMockSession(bearer(request))

    if (!session) {
      return error(401, { code: "unauthenticated", message: "Sign in to continue." })
    }

    if (session.expired) {
      deleteMockSession(session.token)
      return error(401, { code: "session_expired", message: "Your session has expired." })
    }

    return HttpResponse.json({
      token: session.token,
      expiresAt: session.expiresAt,
      user: session.user,
    })
  }),

  http.post("*/api/auth/forgot-password", async ({ request }) => {
    const body = await readJson<ForgotPasswordInput>(request)

    if (isNetwork(body.email)) {
      return HttpResponse.error()
    }

    if (!body.email) {
      return error(400, { code: "validation_error", message: "Email is required." })
    }

    const user = findMockUser(body.email)
    const message = "If an account exists for that email, a mock reset token is ready."

    if (!user) {
      return HttpResponse.json({ message })
    }

    const reset = createMockReset(user.email)
    return HttpResponse.json({ message, resetToken: reset.token })
  }),

  http.post("*/api/auth/reset-password", async ({ request }) => {
    const body = await readJson<ResetPasswordInput>(request)

    if (!body.token || !body.password || body.password.length < 8) {
      return error(400, { code: "validation_error", message: "A reset token and a password of at least 8 characters are required." })
    }

    const reset = consumeMockReset(body.token)

    if (!reset) {
      return error(400, { code: "invalid_reset_token", message: "This reset token is invalid or expired." })
    }

    updateMockPassword(reset.email, body.password)
    return HttpResponse.json({ message: "Password updated. Sign in with the new password." })
  }),

  http.get("*/api/auth/mock-hint", () => {
    const hint = readMockHint()

    if (!hint) {
      return error(404, { code: "unknown", message: "No mock account is available." })
    }

    return HttpResponse.json(hint)
  }),

  http.get("*/api/operations/dashboard", ({ request }) => {
    const url = new URL(request.url)
    const query = {
      environment: url.searchParams.get("environment") ?? "",
      range: url.searchParams.get("range") ?? "",
    }

    if (!isDashboardQuery(query)) {
      return error(400, { code: "validation_error", message: "Environment or date range is not supported." })
    }

    return HttpResponse.json(
      deriveDashboard(
        {
          asOf: operationsFixture.asOf,
          agents: listAgents(),
          executions: listExecutions(),
        },
        query,
      ),
    )
  }),

  http.post("*/api/operations/agents", async ({ request }) => {
    const body = await readJson<{ name?: string; environment?: string }>(request)
    const name = body.name?.trim() ?? ""
    const environment = body.environment
    const environments = new Set<RuntimeEnvironment>(["production", "staging", "sandbox"])

    if (name.length < 2 || !environments.has(environment as RuntimeEnvironment)) {
      return error(400, { code: "validation_error", message: "Enter an agent name and environment." })
    }

    const agent = createStoredAgent({ name, environment: environment as RuntimeEnvironment })
    recordAudit({
      actor: auditActor(request),
      action: "agent.created",
      resourceType: "agent",
      resourceId: agent.id,
      outcome: "succeeded",
      detail: `${agent.name} was created.`,
      fields: { environment: agent.environment },
    })
    return HttpResponse.json({ agent }, { status: 201 })
  }),

  http.get("*/api/agents", ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get("page") ?? "1")
    const query = {
      q: url.searchParams.get("q") ?? "",
      status: url.searchParams.get("status") ?? "all",
      environment: url.searchParams.get("environment") ?? "all",
      type: url.searchParams.get("type") ?? "all",
      sort: url.searchParams.get("sort") ?? "name",
      page,
    }

    if (!isAgentListQuery(query)) {
      return error(400, { code: "validation_error", message: "Agent filters are not supported." })
    }

    return HttpResponse.json({ ...queryAgents(listAgents(), listExecutions(), query), simulated: true })
  }),

  http.post("*/api/agents", async ({ request }) => {
    const body = await readJson<Partial<AgentWriteInput>>(request)
    const parsed = readAgentWrite(body)
    if (!parsed) return error(400, { code: "validation_error", message: "Check the agent name, version, and configuration." })
    const agent = createStoredAgent(parsed)
    recordAudit({
      actor: auditActor(request),
      action: "agent.created",
      resourceType: "agent",
      resourceId: agent.id,
      outcome: "succeeded",
      detail: `${agent.name} was created.`,
      fields: { environment: agent.environment, version: agent.version },
    })
    return HttpResponse.json({ agent }, { status: 201 })
  }),

  ...agentStudioHandlers,

  http.get("*/api/agents/:id", ({ params }) => {
    const agent = listAgents().find((item) => item.id === params.id)
    if (!agent) return error(404, { code: "unknown", message: "This agent is not in the catalog." })
    const executions = listExecutions().filter((execution) => execution.agentId === agent.id)
    const stats = agentStats(agent.id, executions)
    return HttpResponse.json({
      simulated: true,
      agent,
      stats,
      executions: stats.recentRuns,
      logs: logsFor(executions),
      versions: versionsFor(agent),
    })
  }),

  http.patch("*/api/agents/:id", async ({ params, request }) => {
    const body = await readJson<Partial<AgentWriteInput>>(request)
    if (isStatusOnly(body)) {
      const agent = updateStoredAgent(String(params.id), { status: body.status })
      if (!agent) return error(404, { code: "unknown", message: "This agent is not in the catalog." })
      recordAudit({
        actor: auditActor(request),
        action: "agent.status_changed",
        resourceType: "agent",
        resourceId: agent.id,
        outcome: "succeeded",
        detail: `${agent.name} is now ${agent.status}.`,
        fields: { status: agent.status },
      })
      return HttpResponse.json({ agent })
    }
    const parsed = readAgentWrite(body, true)
    if (!parsed) return error(400, { code: "validation_error", message: "Check the agent name, version, and configuration." })
    const agent = updateStoredAgent(String(params.id), parsed)
    if (!agent) return error(404, { code: "unknown", message: "This agent is not in the catalog." })
    recordAudit({
      actor: auditActor(request),
      action: "agent.updated",
      resourceType: "agent",
      resourceId: agent.id,
      outcome: "succeeded",
      detail: `${agent.name} was updated.`,
      fields: { version: agent.version, environment: agent.environment },
    })
    return HttpResponse.json({ agent })
  }),

  http.delete("*/api/agents/:id", ({ params, request }) => {
    const id = String(params.id)
    if (!deleteStoredAgent(id)) {
      return error(404, { code: "unknown", message: "This agent is not in the catalog." })
    }
    recordAudit({
      actor: auditActor(request),
      action: "agent.deleted",
      resourceType: "agent",
      resourceId: id,
      outcome: "succeeded",
      detail: "Agent removed from the catalog.",
    })
    return new HttpResponse(null, { status: 204 })
  }),

  http.post("*/api/agents/:id/executions", ({ params, request }) => {
    const result = triggerStoredExecution(String(params.id))
    if (result.error === "missing") return error(404, { code: "unknown", message: "This agent is not in the catalog." })
    if (result.error === "paused") {
      return error(409, { code: "validation_error", message: "Paused agents cannot run." })
    }
    recordAudit({
      actor: auditActor(request),
      action: "execution.triggered",
      resourceType: "execution",
      resourceId: result.execution.id,
      outcome: result.execution.status === "failed" ? "failed" : "succeeded",
      detail: `Run ${result.execution.id} was recorded as ${result.execution.status}.`,
      fields: { agentId: result.execution.agentId, status: result.execution.status },
    })
    return HttpResponse.json({ execution: result.execution }, { status: 201 })
  }),

  ...workflowHandlers,
  ...executionHandlers,
  ...analyticsHandlers,
  ...deploymentHandlers,
  ...auditHandlers,
  ...settingsHandlers,
  ...playgroundHandlers,
  ...ragHandlers,
  ...knowledgeHandlers,
]

const agentTypes = new Set<AgentType>(["planner", "researcher", "operator", "reviewer"])
const retryPolicies = new Set<RetryPolicy>(["none", "fixed", "exponential"])
const agentStatuses = new Set<AgentStatus>(["active", "idle", "paused", "error"])
const runtimeEnvironments = new Set<RuntimeEnvironment>(["production", "staging", "sandbox"])

function isStatusOnly(body: Partial<AgentWriteInput>): body is { status: AgentStatus } {
  return body.status !== undefined && agentStatuses.has(body.status) && body.name === undefined
}

function readAgentWrite(body: Partial<AgentWriteInput>, withStatus = false) {
  const name = body.name?.trim() ?? ""
  const description = body.description?.trim() ?? ""
  const version = body.version?.trim() ?? ""
  const configuration = body.configuration
  const timeout = body.timeoutMs
  if (
    name.length < 2 ||
    description.length < 8 ||
    !agentTypes.has(body.type as AgentType) ||
    !runtimeEnvironments.has(body.environment as RuntimeEnvironment) ||
    !retryPolicies.has(body.retryPolicy as RetryPolicy) ||
    !/^\d+\.\d+\.\d+$/.test(version) ||
    typeof timeout !== "number" ||
    timeout < 1000 ||
    timeout > 300000 ||
    !configuration ||
    typeof configuration !== "object" ||
    Array.isArray(configuration) ||
    (withStatus && !agentStatuses.has(body.status as AgentStatus))
  ) {
    return null
  }

  return {
    name,
    description,
    type: body.type as AgentType,
    environment: body.environment as RuntimeEnvironment,
    timeoutMs: timeout,
    retryPolicy: body.retryPolicy as RetryPolicy,
    version,
    configuration,
    ...(withStatus ? { status: body.status as AgentStatus } : {}),
  }
}
