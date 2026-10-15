"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/shared/page-header"
import { isApiError } from "@/features/auth/api/errors"
import { emptyKnowledgeForm } from "@/features/knowledge/catalog"
import { useCreateKnowledgeBase } from "@/features/knowledge/hooks"
import { KnowledgeFields } from "@/features/knowledge/knowledge-fields"
import type { KnowledgeField, KnowledgeFormValues } from "@/features/knowledge/types"
import { assessKnowledgeForm } from "@/features/knowledge/validate"
import { localWorkspace } from "@/lib/workspace"

export function KnowledgeCreateScreen() {
  const router = useRouter()
  const create = useCreateKnowledgeBase()
  const [values, setValues] = useState<KnowledgeFormValues>(emptyKnowledgeForm)
  const [errors, setErrors] = useState<Partial<Record<KnowledgeField, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        title="New knowledge base"
        description="Choose a simulated embedding model and the chunk window future documents will use. Nothing is sent to a provider."
        actions={
          <Link href="/knowledge-bases" className="text-sm text-primary underline-offset-4 hover:underline">
            Back to knowledge bases
          </Link>
        }
      />
      <KnowledgeFields
        values={values}
        errors={errors}
        pending={create.isPending}
        submitLabel="Create knowledge base"
        formError={formError}
        onChange={(field, value) => setValues((current) => ({ ...current, [field]: value }))}
        onSubmit={() => {
          const assessed = assessKnowledgeForm(values)
          setErrors(assessed.errors)
          if (!assessed.ok) {
            setFormError(null)
            return
          }
          setFormError(null)
          void create
            .mutateAsync({
              workspaceId: localWorkspace.id,
              name: assessed.name,
              description: assessed.description,
              settings: assessed.settings,
            })
            .then((result) => {
              router.push(`/knowledge-bases/${result.knowledgeBase.id}`)
            })
            .catch((reason: unknown) => {
              setFormError(isApiError(reason) ? reason.message : "The knowledge service could not be reached.")
            })
        }}
      />
    </div>
  )
}
