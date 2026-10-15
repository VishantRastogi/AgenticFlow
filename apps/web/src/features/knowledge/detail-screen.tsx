"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { DocumentUploadZone, EmbeddingStatus } from "@/components/ai/studio"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ErrorState } from "@/components/shared/error-state"
import { PageHeader } from "@/components/shared/page-header"
import { ListSkeleton, PageSkeleton } from "@/components/shared/skeletons"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isApiError } from "@/features/auth/api/errors"
import { embeddingModel, formatBytes, formatTimestamp, stageLabel } from "@/features/knowledge/catalog"
import {
  useDeleteKnowledgeBase,
  useDocuments,
  useIngestionWatcher,
  useKnowledgeBase,
  useReindexKnowledgeBase,
  useUpdateKnowledgeBase,
  useUploadDocument,
} from "@/features/knowledge/hooks"
import { KnowledgeFields } from "@/features/knowledge/knowledge-fields"
import type { IngestionStage, KnowledgeField, KnowledgeFormValues } from "@/features/knowledge/types"
import { isTerminalStage } from "@/features/knowledge/types"
import { assessKnowledgeForm, formValuesFromSettings, inspectFile } from "@/features/knowledge/validate"
import { localWorkspace } from "@/lib/workspace"

const selectClass =
  "h-8 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

type UploadRow = {
  id: string
  name: string
  progress: number
  state: "uploading" | "accepted" | "rejected"
  detail: string
}

export function KnowledgeDetailScreen({ knowledgeBaseId }: { knowledgeBaseId: string }) {
  const router = useRouter()
  const detail = useKnowledgeBase(knowledgeBaseId)
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<"all" | IngestionStage>("all")
  const [page, setPage] = useState(1)
  const documents = useDocuments(knowledgeBaseId, { q, status, page })
  const update = useUpdateKnowledgeBase(knowledgeBaseId)
  const reindex = useReindexKnowledgeBase(knowledgeBaseId)
  const remove = useDeleteKnowledgeBase()
  const upload = useUploadDocument(knowledgeBaseId)
  const activeJobs = detail.data?.activeJobs ?? []
  const pollError = useIngestionWatcher(
    knowledgeBaseId,
    activeJobs.map((job) => job.id),
  )
  const [values, setValues] = useState<KnowledgeFormValues | null>(null)
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<KnowledgeField, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [uploads, setUploads] = useState<UploadRow[]>([])
  const timers = useRef<number[]>([])
  const mounted = useRef(true)
  const base = detail.data?.knowledgeBase

  useEffect(() => {
    mounted.current = true
    const activeTimers = timers.current
    return () => {
      mounted.current = false
      activeTimers.forEach((timer) => window.clearInterval(timer))
    }
  }, [])

  useEffect(() => {
    if (!base || dirty) return
    const next = formValuesFromSettings(base)
    setValues((current) => (current && JSON.stringify(current) === JSON.stringify(next) ? current : next))
  }, [base, dirty])

  const total = documents.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / (documents.data?.pageSize ?? 8)))

  async function acceptFiles(files: File[]) {
    for (const [index, file] of files.entries()) {
      const id = `${file.name}-${file.size}-${index}-${file.lastModified}`
      const inspected = inspectFile(file)
      if (!inspected.ok) {
        setUploads((current) => [...current, { id, name: file.name, progress: 0, state: "rejected", detail: inspected.message }])
        continue
      }
      if (mounted.current) {
        setUploads((current) => [...current, { id, name: file.name, progress: 12, state: "uploading", detail: "Uploading to the mock API." }])
      }
      const timer = window.setInterval(() => {
        if (!mounted.current) return
        setUploads((current) =>
          current.map((row) => (row.id === id && row.state === "uploading" ? { ...row, progress: Math.min(90, row.progress + 18) } : row)),
        )
      }, 40)
      timers.current.push(timer)
      try {
        await upload.mutateAsync({
          workspaceId: localWorkspace.id,
          name: file.name,
          mediaType: inspected.mediaType,
          sizeBytes: file.size,
        })
        if (!mounted.current) return
        setUploads((current) =>
          current.map((row) =>
            row.id === id
              ? { ...row, progress: 100, state: "accepted", detail: "Stored by the mock API. Ingestion has not parsed the file." }
              : row,
          ),
        )
      } catch (reason) {
        if (!mounted.current) return
        setUploads((current) =>
          current.map((row) =>
            row.id === id
              ? {
                  ...row,
                  progress: 0,
                  state: "rejected",
                  detail: isApiError(reason) ? reason.message : "The knowledge service could not be reached.",
                }
              : row,
          ),
        )
      } finally {
        window.clearInterval(timer)
      }
    }
  }

  if (detail.isPending || (base && !values)) return <PageSkeleton />
  if (detail.isError || !base || !values) {
    return (
      <ErrorState
        title="Knowledge base unavailable"
        description={isApiError(detail.error) ? detail.error.message : "Knowledge base not found."}
        onRetry={() => void detail.refetch()}
      />
    )
  }

  const model = embeddingModel(base.settings.embeddingModel)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={base.name}
        description={base.description || "No description. Ingestion on this page is simulated."}
        actions={
          <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        }
      />
      <p className="text-sm text-muted-foreground">
        <Link href="/knowledge-bases" className="text-primary underline-offset-4 hover:underline">
          Knowledge bases
        </Link>
      </p>
      <p role="status" className="text-sm text-muted-foreground">
        Mock ingestion. Documents are not parsed, and no embeddings are computed.
      </p>
      {pollError ? (
        <p role="alert" className="text-sm text-destructive">
          {pollError}
        </p>
      ) : null}
      <dl className="grid gap-3 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Documents</dt>
          <dd className="font-medium">{base.documentCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Storage</dt>
          <dd className="font-medium">{formatBytes(base.storageBytes)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Updated</dt>
          <dd>{formatTimestamp(base.updatedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Embedding model</dt>
          <dd>{model?.label}</dd>
          <EmbeddingStatus model={model?.label ?? base.settings.embeddingModel} state={embeddingState(base.ingestionStatus)} />
        </div>
      </dl>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="grid gap-1 text-xs text-muted-foreground sm:min-w-56">
              Search documents
              <Input
                value={q}
                aria-label="Search documents"
                onChange={(event) => {
                  setQ(event.target.value)
                  setPage(1)
                }}
              />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Status
              <select
                className={selectClass}
                aria-label="Document status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as "all" | IngestionStage)
                  setPage(1)
                }}
              >
                <option value="all">All</option>
                {(["UPLOADED", "QUEUED", "PARSING", "CHUNKING", "EMBEDDING", "INDEXING", "READY", "FAILED"] as const).map((stage) => (
                  <option key={stage} value={stage}>
                    {stageLabel(stage)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {documents.isPending ? <ListSkeleton /> : null}
          {documents.isError && !documents.data ? (
            <ErrorState
              title="Documents unavailable"
              description={isApiError(documents.error) ? documents.error.message : "The knowledge service could not be reached."}
              onRetry={() => void documents.refetch()}
            />
          ) : null}
          {documents.data && documents.data.items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
              {q || status !== "all" ? "No documents match these filters." : "No documents yet. Upload a PDF, DOCX, TXT, or Markdown file."}
            </p>
          ) : null}
          {documents.data && documents.data.items.length > 0 ? (
            <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <caption className="sr-only">Documents</caption>
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Attempt</th>
                    <th className="px-4 py-3 font-medium">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.data.items.map((document) => (
                    <tr key={document.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <Link href={`/knowledge-bases/${base.id}/documents/${document.id}`} className="font-medium hover:text-primary">
                          {document.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={document.status === "FAILED" ? "danger" : document.status === "READY" ? "success" : "info"}>
                          {stageLabel(document.status)}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3">{document.attempt}</td>
                      <td className="px-4 py-3">{formatBytes(document.sizeBytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {documents.data && total > documents.data.pageSize ? (
            <nav aria-label="Document pagination" className="flex items-center justify-between gap-3">
              <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                Previous
              </Button>
              <p className="text-sm text-muted-foreground">
                Page {page} of {pages}
              </p>
              <Button type="button" variant="outline" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>
                Next
              </Button>
            </nav>
          ) : null}
        </div>
        <div className="grid content-start gap-4">
          <DocumentUploadZone
            disabled={upload.isPending}
            note="Accepted files are stored by the mock ingestion API. Parsing and embeddings stay simulated."
            onFiles={(files) => {
              void acceptFiles(files)
            }}
          />
          {uploads.length > 0 ? (
            <ul className="grid gap-2" aria-label="Upload progress">
              {uploads.map((row) => (
                <li key={row.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <p className="font-medium">{row.name}</p>
                  <p role="status">
                    Upload {row.progress}%. {row.detail}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className="h-full bg-primary" style={{ width: `${row.progress}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <section className="max-w-2xl">
        <h2 className="text-base font-medium">Retrieval defaults</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Saved settings apply to new simulated ingestion. Existing chunks stay as they were built until you reindex.
        </p>
        {base.reindexRequired ? (
          <div className="mb-4 grid gap-2">
            <p role="status">Chunk or embedding settings changed. Reindex starts a new attempt for each document.</p>
            <Button
              type="button"
              variant="outline"
              disabled={reindex.isPending || base.ingestionStatus === "processing" || base.documentCount === 0}
              onClick={() => {
                setFormError(null)
                void reindex.mutateAsync().catch((reason: unknown) => {
                  setFormError(isApiError(reason) ? reason.message : "The knowledge service could not be reached.")
                })
              }}
            >
              Reindex documents
            </Button>
          </div>
        ) : null}
        {saved ? <p role="status">Knowledge base saved.</p> : null}
        <KnowledgeFields
          values={values}
          errors={errors}
          pending={update.isPending}
          submitLabel="Save changes"
          formError={formError}
          onChange={(field, value) => {
            setDirty(true)
            setSaved(false)
            setValues((current) => (current ? { ...current, [field]: value } : current))
          }}
          onSubmit={() => {
            const assessed = assessKnowledgeForm(values)
            setErrors(assessed.errors)
            if (!assessed.ok) return
            setFormError(null)
            void update
              .mutateAsync({ name: assessed.name, description: assessed.description, settings: assessed.settings })
              .then(() => {
                setDirty(false)
                setSaved(true)
              })
              .catch((reason: unknown) => {
                setFormError(isApiError(reason) ? reason.message : "The knowledge service could not be reached.")
              })
          }}
        />
      </section>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete knowledge base"
        description={`${base.name} and its simulated documents will be removed from this workspace.`}
        confirmLabel="Delete knowledge base"
        destructive
        onConfirm={() => {
          void remove.mutateAsync(base.id).then(() => router.push("/knowledge-bases"))
        }}
      />
      {activeJobs.some((job) => !isTerminalStage(job.stage)) ? (
        <p className="sr-only" role="status">
          Ingestion is still running.
        </p>
      ) : null}
    </div>
  )
}

function embeddingState(status: "empty" | "processing" | "ready" | "attention") {
  if (status === "processing") return "running" as const
  if (status === "ready") return "ready" as const
  if (status === "attention") return "failed" as const
  return "idle" as const
}
