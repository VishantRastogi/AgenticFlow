"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { parseConfiguration, agentFormSchema, agentUpdateSchema, type AgentFormValues, type AgentUpdateValues } from "@/features/agents/schemas"
import type { AgentWriteInput } from "@/features/agents/types"

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

const createDefaults: AgentFormValues = {
  name: "",
  description: "",
  type: "operator",
  environment: "production",
  timeoutMs: 30000,
  retryPolicy: "fixed",
  version: "0.1.0",
  configuration: '{\n  "model": "orbit-small"\n}',
}

export function AgentForm({
  mode,
  defaults,
  pending,
  error,
  onSubmit,
}: {
  mode: "create" | "edit"
  defaults?: AgentUpdateValues
  pending: boolean
  error?: string | null
  onSubmit: (input: AgentWriteInput) => Promise<void>
}) {
  const form = useForm<AgentFormValues | AgentUpdateValues>({
    resolver: zodResolver(mode === "edit" ? agentUpdateSchema : agentFormSchema),
    defaultValues: defaults ?? createDefaults,
  })

  const submit = form.handleSubmit(async (values) => {
    await onSubmit({
      name: values.name,
      description: values.description,
      type: values.type,
      environment: values.environment,
      timeoutMs: values.timeoutMs,
      retryPolicy: values.retryPolicy,
      version: values.version,
      configuration: parseConfiguration(values.configuration),
      ...("status" in values ? { status: values.status } : {}),
    })
  })

  return (
    <form className="grid gap-4" onSubmit={submit} noValidate>
      <Field label="Name" error={form.formState.errors.name?.message}>
        <Input id="agent-name" aria-invalid={Boolean(form.formState.errors.name)} {...form.register("name")} />
      </Field>
      <Field label="Description" error={form.formState.errors.description?.message}>
        <Textarea id="agent-description" className="min-h-24" aria-invalid={Boolean(form.formState.errors.description)} {...form.register("description")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" error={form.formState.errors.type?.message}>
          <select id="agent-type" className={fieldClass} {...form.register("type")}>
            <option value="planner">Planner</option>
            <option value="researcher">Researcher</option>
            <option value="operator">Operator</option>
            <option value="reviewer">Reviewer</option>
          </select>
        </Field>
        <Field label="Environment" error={form.formState.errors.environment?.message}>
          <select id="agent-environment" className={fieldClass} {...form.register("environment")}>
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="sandbox">Sandbox</option>
          </select>
        </Field>
        <Field label="Timeout (ms)" error={form.formState.errors.timeoutMs?.message}>
          <Input id="agent-timeout" type="number" min={1000} max={300000} step={1000} aria-invalid={Boolean(form.formState.errors.timeoutMs)} {...form.register("timeoutMs", { valueAsNumber: true })} />
        </Field>
        <Field label="Retry policy" error={form.formState.errors.retryPolicy?.message}>
          <select id="agent-retry" className={fieldClass} {...form.register("retryPolicy")}>
            <option value="none">None</option>
            <option value="fixed">Fixed</option>
            <option value="exponential">Exponential</option>
          </select>
        </Field>
        <Field label="Version" error={form.formState.errors.version?.message}>
          <Input id="agent-version" aria-invalid={Boolean(form.formState.errors.version)} {...form.register("version")} />
        </Field>
        {mode === "edit" && "status" in form.getValues() ? (
          <Field label="Status" error={"status" in form.formState.errors ? form.formState.errors.status?.message : undefined}>
            <select id="agent-status" className={fieldClass} {...form.register("status")}>
              <option value="active">Active</option>
              <option value="idle">Idle</option>
              <option value="paused">Paused</option>
              <option value="error">Error</option>
            </select>
          </Field>
        ) : null}
      </div>
      <Field label="Configuration" error={form.formState.errors.configuration?.message}>
        <Textarea id="agent-configuration" className="min-h-36 font-mono text-xs" aria-invalid={Boolean(form.formState.errors.configuration)} {...form.register("configuration")} />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving" : mode === "create" ? "Create agent" : "Save changes"}
        </Button>
      </div>
    </form>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-foreground">
      {label}
      {children}
      {error ? <span className="text-xs font-normal text-destructive">{error}</span> : null}
    </label>
  )
}
