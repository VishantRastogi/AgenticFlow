"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChunkInspector, EmbeddingStatus, IngestionProgress } from "@/components/ai/studio"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ErrorState } from "@/components/shared/error-state"
import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/skeletons"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { isApiError } from "@/features/auth/api/errors"
import { embeddingModel, formatBytes, simulatedDurationBudgetMs, stageLabel } from "@/features/knowledge/catalog"
import {
  useCancelIngestion,
  useDeleteDocument,
  useDocument,
  useIngestionWatcher,
  useKnowledgeBase,
  useRetryDocument,
} from "@/features/knowledge/hooks"
import { isTerminalStage } from "@/features/knowledge/types"

export function KnowledgeDocumentScreen({
  knowledgeBaseId,
  documentId,
}: {
  knowledgeBaseId: string
  documentId: string
}) {
  const router = useRouter()
  const detail = useDocument(knowledgeBaseId, documentId)
  const base = useKnowledgeBase(knowledgeBaseId)
  const retry = useRetryDocument(knowledgeBaseId, documentId)
  const remove = useDeleteDocument(knowledgeBaseId, documentId)
  const document = detail.data?.document
  const job = detail.data?.job
  const cancel = useCancelIngestion(knowledgeBaseId, job?.id ?? "none")
  const pollError = useIngestionWatcher(knowledgeBaseId, job && !isTerminalStage(job.stage) ? [job.id] : [])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const model = embeddingModel(base.data?.knowledgeBase.settings.embeddingModel ?? "")

  if (detail.isPending) return <PageSkeleton />
  if (detail.isError || !document || !job) {
    return (
      <ErrorState
        title="Document unavailable"
        description={isApiError(detail.error) ? detail.error.message : "Document not found."}
        onRetry={() => void detail.refetch()}
      />
    )
  }

  const failed = job.stage === "FAILED"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={document.name}
        description={`${formatBytes(document.sizeBytes)} · attempt ${document.attempt}. This preview is simulated.`}
        actions={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!failed || retry.isPending}
              onClick={() => {
                setActionError(null)
                void retry.mutateAsync().catch((reason: unknown) => {
                  setActionError(isApiError(reason) ? reason.message : "The knowledge service could not be reached.")
                })
              }}
            >
              Retry ingestion
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isTerminalStage(job.stage) || cancel.isPending}
              onClick={() => {
                setActionError(null)
                void cancel.mutateAsync().catch((reason: unknown) => {
                  setActionError(isApiError(reason) ? reason.message : "The knowledge service could not be reached.")
                })
              }}
            >
              Cancel ingestion
            </Button>
            <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
              Delete document
            </Button>
          </div>
        }
      />
      <p className="text-sm text-muted-foreground">
        <Link href={`/knowledge-bases/${knowledgeBaseId}`} className="text-primary underline-offset-4 hover:underline">
          {base.data?.knowledgeBase.name ?? "Knowledge base"}
        </Link>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge tone={failed ? "danger" : job.stage === "READY" ? "success" : "info"}>{stageLabel(job.stage)}</StatusBadge>
        <p role="status">
          Ingestion status: {stageLabel(job.stage)}. Simulated pipeline.
        </p>
      </div>
      {pollError || actionError || job.error ? (
        <p role="alert" className="text-sm text-destructive">
          {pollError || actionError || job.error}
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <section className="grid content-start gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="text-sm font-medium">Processing timeline</h2>
          <IngestionProgress stage={failed ? (job.failedStage ?? "FAILED") : job.stage} failed={failed} />
          <p className="text-xs text-muted-foreground">
            Simulated duration {job.durationMs} ms of {simulatedDurationBudgetMs} ms. This page reads job state. The mock worker advances stages.
          </p>
          <EmbeddingStatus
            model={model?.label ?? "Simulated model"}
            state={job.stage === "READY" ? "ready" : failed ? "failed" : job.stage === "EMBEDDING" || job.stage === "INDEXING" ? "running" : "idle"}
          />
          <h3 className="text-sm font-medium">Metadata</h3>
          <dl className="grid gap-1 text-xs text-muted-foreground">
            {Object.entries(document.metadata).map(([key, value]) => (
              <div key={key}>
                <dt className="inline">{key}: </dt>
                <dd className="inline">{value}</dd>
              </div>
            ))}
          </dl>
          {detail.data && detail.data.jobs.length > 1 ? (
            <p className="text-xs text-muted-foreground">Attempts recorded: {detail.data.jobs.map((item) => item.attempt).join(", ")}.</p>
          ) : null}
        </section>
        <div className="grid content-start gap-4">
          <section aria-label="Extracted text preview" className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="text-sm font-medium">Extracted text preview</h2>
            {document.extractedText ? (
              <p className="mt-2 text-sm leading-6">{document.extractedText}</p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Extracted text appears after the simulated parser stage. Nothing has been read from the file.
              </p>
            )}
          </section>
          <section className="grid gap-3">
            <h2 className="text-sm font-medium">Chunks</h2>
            {detail.data && detail.data.chunks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chunks appear after the simulated chunking stage.</p>
            ) : null}
            {detail.data?.chunks.map((chunk) => (
              <ChunkInspector key={chunk.id} chunkId={chunk.id} content={chunk.content} metadata={chunk.metadata} />
            ))}
          </section>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete document"
        description={`${document.name} and its simulated chunks will be removed.`}
        confirmLabel="Delete document"
        destructive
        onConfirm={() => {
          void remove.mutateAsync().then(() => router.push(`/knowledge-bases/${knowledgeBaseId}`))
        }}
      />
    </div>
  )
}
