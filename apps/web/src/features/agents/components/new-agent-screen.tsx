"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { isApiError } from "@/features/auth/api/errors"
import { AgentForm } from "@/features/agents/components/agent-form"
import { useCreateAgentRecord } from "@/features/agents/hooks"
import type { AgentWriteInput } from "@/features/agents/types"

export function NewAgentScreen() {
  const router = useRouter()
  const create = useCreateAgentRecord()
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(input: AgentWriteInput) {
    setError(null)
    try {
      const result = await create.mutateAsync(input)
      router.push(`/agents/${result.agent.id}`)
    } catch (caught) {
      setError(isApiError(caught) ? caught.message : "The agent could not be created.")
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="border-b border-border/80 pb-5">
        <Link href="/agents" className="text-xs font-medium tracking-wide text-highlight uppercase">
          Agent Studio
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">New agent</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The agent starts idle. Configuration is stored with the shared mock catalog.
        </p>
      </header>
      <AgentForm mode="create" pending={create.isPending} error={error} onSubmit={onSubmit} />
    </div>
  )
}
