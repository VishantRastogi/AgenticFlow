"use client"

import { useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { LayoutGrid, Plus, Table } from "lucide-react"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ErrorState } from "@/components/shared/error-state"
import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/skeletons"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { isApiError } from "@/features/auth/api/errors"
import { embeddingModel, formatBytes, formatTimestamp } from "@/features/knowledge/catalog"
import { useDeleteKnowledgeBase, useKnowledgeList, useUpdateKnowledgeBase } from "@/features/knowledge/hooks"
import type { IngestionRollup, KnowledgeBase, KnowledgeListParams } from "@/features/knowledge/types"
import { motionTransition } from "@/lib/motion"

const selectClass =
  "h-8 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

const rollupTone = {
  empty: "neutral",
  processing: "info",
  ready: "success",
  attention: "warning",
} as const

const rollupLabel: Record<IngestionRollup, string> = {
  empty: "Empty",
  processing: "Processing",
  ready: "Ready",
  attention: "Needs attention",
}

export function KnowledgeLibraryScreen() {
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<KnowledgeListParams["status"]>("all")
  const [model, setModel] = useState<KnowledgeListParams["model"]>("all")
  const [sort, setSort] = useState<KnowledgeListParams["sort"]>("updated")
  const [page, setPage] = useState(1)
  const [view, setView] = useState<"grid" | "table">("grid")
  const [renaming, setRenaming] = useState<KnowledgeBase | null>(null)
  const [removing, setRemoving] = useState<KnowledgeBase | null>(null)
  const remove = useDeleteKnowledgeBase()
  const reduced = useReducedMotion() === true
  const skipMotion = reduced || process.env.VITEST === "true"
  const list = useKnowledgeList({ q, status, model, sort, page })
  const total = list.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / (list.data?.pageSize ?? 6)))
  const filtered = q.trim().length > 0 || status !== "all" || model !== "all"

  function update<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value)
      setPage(1)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Knowledge Bases"
        description="Collections stay in this workspace. Ingestion is simulated: documents are not parsed, and no embeddings are computed."
        actions={
          <Button asChild>
            <Link href="/knowledge-bases/new">
              <Plus aria-hidden="true" />
              New knowledge base
            </Link>
          </Button>
        }
      />
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <label className="grid gap-1 text-xs text-muted-foreground lg:min-w-56">
          Search
          <Input value={q} aria-label="Search knowledge bases" placeholder="Name or description" onChange={(event) => update(setQ)(event.target.value)} />
        </label>
        <Filter
          label="Status"
          value={status}
          onChange={update(setStatus)}
          options={[
            ["all", "All"],
            ["empty", "Empty"],
            ["processing", "Processing"],
            ["ready", "Ready"],
            ["attention", "Needs attention"],
          ]}
        />
        <Filter
          label="Model"
          value={model}
          onChange={update(setModel)}
          options={[
            ["all", "All"],
            ["orbit-embed-small", "Orbit Embed Small"],
            ["orbit-embed-large", "Orbit Embed Large"],
          ]}
        />
        <Filter
          label="Sort"
          value={sort}
          onChange={update(setSort)}
          options={[
            ["updated", "Updated"],
            ["name", "Name"],
            ["documents", "Documents"],
            ["storage", "Storage"],
          ]}
        />
        <div role="radiogroup" aria-label="View" className="flex h-8 overflow-hidden rounded-lg border border-input">
          <ViewButton selected={view === "grid"} label="Grid" onClick={() => setView("grid")}>
            <LayoutGrid aria-hidden="true" />
            Grid
          </ViewButton>
          <ViewButton selected={view === "table"} label="Table" onClick={() => setView("table")}>
            <Table aria-hidden="true" />
            Table
          </ViewButton>
        </div>
      </div>

      {list.isPending ? <PageSkeleton /> : null}
      {list.isError && !list.data ? (
        <ErrorState
          title="Knowledge bases unavailable"
          description={isApiError(list.error) ? list.error.message : "The knowledge service could not be reached."}
          onRetry={() => void list.refetch()}
        />
      ) : null}
      {list.data && list.data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-6 py-10 text-sm text-muted-foreground">
          {filtered ? "No knowledge bases match these filters." : "No knowledge bases in this workspace yet."}
        </p>
      ) : null}
      {list.data && list.data.items.length > 0 ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={skipMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={skipMotion ? undefined : { opacity: 0 }}
            transition={motionTransition(reduced)}
          >
            {view === "grid" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.data.items.map((base) => (
                  <KnowledgeCard key={base.id} base={base} onRename={setRenaming} onDelete={setRemoving} />
                ))}
              </div>
            ) : (
              <KnowledgeTable items={list.data.items} onRename={setRenaming} onDelete={setRemoving} />
            )}
          </motion.div>
        </AnimatePresence>
      ) : null}
      {list.data && total > list.data.pageSize ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
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
      <RenameDialog base={renaming} onOpenChange={(open) => { if (!open) setRenaming(null) }} />
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
        title="Delete knowledge base"
        description={removing ? `${removing.name} and its simulated documents will be removed from this workspace.` : ""}
        confirmLabel="Delete knowledge base"
        destructive
        onConfirm={() => {
          if (!removing) return
          void remove.mutateAsync(removing.id)
        }}
      />
    </div>
  )
}

function KnowledgeCard({
  base,
  onRename,
  onDelete,
}: {
  base: KnowledgeBase
  onRename: (base: KnowledgeBase) => void
  onDelete: (base: KnowledgeBase) => void
}) {
  const model = embeddingModel(base.settings.embeddingModel)
  return (
    <article className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/knowledge-bases/${base.id}`} className="text-base font-medium hover:text-primary">
            {base.name}
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">{model?.label ?? base.settings.embeddingModel}</p>
        </div>
        <StatusBadge tone={rollupTone[base.ingestionStatus]}>{rollupLabel[base.ingestionStatus]}</StatusBadge>
      </div>
      <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{base.description || "No description"}</p>
      <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>
          <dt>Documents</dt>
          <dd className="font-medium text-foreground">{base.documentCount}</dd>
        </div>
        <div>
          <dt>Storage</dt>
          <dd className="font-medium text-foreground">{formatBytes(base.storageBytes)}</dd>
        </div>
        <div className="col-span-2">
          <dt>Updated</dt>
          <dd>{formatTimestamp(base.updatedAt)}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">{model?.note}</p>
      <div className="mt-auto flex gap-2">
        <Button type="button" variant="outline" onClick={() => onRename(base)}>
          Rename {base.name}
        </Button>
        <Button type="button" variant="destructive" onClick={() => onDelete(base)}>
          Delete {base.name}
        </Button>
      </div>
    </article>
  )
}

function KnowledgeTable({
  items,
  onRename,
  onDelete,
}: {
  items: KnowledgeBase[]
  onRename: (base: KnowledgeBase) => void
  onDelete: (base: KnowledgeBase) => void
}) {
  return (
    <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
      <table className="w-full min-w-[52rem] text-left text-sm">
        <caption className="sr-only">Knowledge bases</caption>
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Documents</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Model</th>
            <th className="px-4 py-3 font-medium">Storage</th>
            <th className="px-4 py-3 font-medium">Updated</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((base) => (
            <tr key={base.id} className="border-t border-border">
              <td className="px-4 py-3">
                <Link href={`/knowledge-bases/${base.id}`} className="font-medium hover:text-primary">
                  {base.name}
                </Link>
              </td>
              <td className="px-4 py-3">{base.documentCount}</td>
              <td className="px-4 py-3">
                <StatusBadge tone={rollupTone[base.ingestionStatus]}>{rollupLabel[base.ingestionStatus]}</StatusBadge>
              </td>
              <td className="px-4 py-3">{embeddingModel(base.settings.embeddingModel)?.label}</td>
              <td className="px-4 py-3">{formatBytes(base.storageBytes)}</td>
              <td className="px-4 py-3">{formatTimestamp(base.updatedAt)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => onRename(base)}>
                    Rename {base.name}
                  </Button>
                  <Button type="button" variant="destructive" onClick={() => onDelete(base)}>
                    Delete {base.name}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RenameDialog({ base, onOpenChange }: { base: KnowledgeBase | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={Boolean(base)} onOpenChange={onOpenChange}>
      <DialogContent>
        {base ? <RenameForm key={base.id} base={base} onOpenChange={onOpenChange} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function RenameForm({ base, onOpenChange }: { base: KnowledgeBase; onOpenChange: (open: boolean) => void }) {
  const update = useUpdateKnowledgeBase(base.id)
  const [name, setName] = useState(base.name)
  const [description, setDescription] = useState(base.description)
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        setError(null)
        void update
          .mutateAsync({ name, description, settings: base.settings })
          .then(() => onOpenChange(false))
          .catch((reason: unknown) => {
            setError(isApiError(reason) ? reason.message : "The knowledge service could not be reached.")
          })
      }}
    >
      <DialogHeader>
        <DialogTitle>Rename {base.name}</DialogTitle>
        <DialogDescription>The name must stay unique in this workspace. Settings are unchanged.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 py-4">
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <label className="grid gap-1.5 text-sm font-medium" htmlFor="rename-knowledge">
          Name
          <Input id="rename-knowledge" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium" htmlFor="rename-description">
          Description
          <Textarea id="rename-description" value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={update.isPending}>
          Save name
        </Button>
      </DialogFooter>
    </form>
  )
}

function Filter<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: [T, string][]
  onChange: (value: T) => void
}) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <select className={selectClass} value={value} aria-label={label} onChange={(event) => onChange(event.target.value as T)}>
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}

function ViewButton({
  selected,
  label,
  onClick,
  children,
}: {
  selected: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 px-3 text-sm ${selected ? "bg-muted text-foreground" : "text-muted-foreground"}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
