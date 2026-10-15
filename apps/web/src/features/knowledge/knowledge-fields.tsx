"use client"

import { embeddingModels } from "@/features/knowledge/catalog"
import type { KnowledgeField, KnowledgeFormValues } from "@/features/knowledge/types"
import { JSONSchemaEditor } from "@/components/ai/studio"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function KnowledgeFields({
  values,
  errors,
  pending,
  submitLabel,
  formError,
  onChange,
  onSubmit,
}: {
  values: KnowledgeFormValues
  errors: Partial<Record<KnowledgeField, string>>
  pending: boolean
  submitLabel: string
  formError?: string | null
  onChange: (field: KnowledgeField, value: string) => void
  onSubmit: () => void
}) {
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <Field id="knowledge-name" label="Name" error={errors.name}>
        <Input
          id="knowledge-name"
          value={values.name}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "knowledge-name-error" : undefined}
          onChange={(event) => onChange("name", event.target.value)}
        />
      </Field>
      <Field id="knowledge-description" label="Description" error={errors.description}>
        <Textarea
          id="knowledge-description"
          value={values.description}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? "knowledge-description-error" : undefined}
          onChange={(event) => onChange("description", event.target.value)}
        />
      </Field>
      <Field id="knowledge-model" label="Embedding model" error={errors.embeddingModel}>
        <select
          id="knowledge-model"
          className={selectClass}
          value={values.embeddingModel}
          aria-invalid={Boolean(errors.embeddingModel)}
          aria-describedby={errors.embeddingModel ? "knowledge-model-error" : undefined}
          onChange={(event) => onChange("embeddingModel", event.target.value)}
        >
          {embeddingModels.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label} · {model.dimensions} dimensions
            </option>
          ))}
        </select>
        <span className="text-xs font-normal text-muted-foreground">
          {embeddingModels.find((model) => model.id === values.embeddingModel)?.note}
        </span>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="knowledge-chunk-size" label="Chunk size" error={errors.chunkSize}>
          <Input
            id="knowledge-chunk-size"
            inputMode="numeric"
            value={values.chunkSize}
            aria-invalid={Boolean(errors.chunkSize)}
            aria-describedby={errors.chunkSize ? "knowledge-chunk-size-error" : undefined}
            onChange={(event) => onChange("chunkSize", event.target.value)}
          />
        </Field>
        <Field id="knowledge-chunk-overlap" label="Chunk overlap" error={errors.chunkOverlap}>
          <Input
            id="knowledge-chunk-overlap"
            inputMode="numeric"
            value={values.chunkOverlap}
            aria-invalid={Boolean(errors.chunkOverlap)}
            aria-describedby={errors.chunkOverlap ? "knowledge-chunk-overlap-error" : undefined}
            onChange={(event) => onChange("chunkOverlap", event.target.value)}
          />
        </Field>
        <Field id="knowledge-top-k" label="Top K" error={errors.topK}>
          <Input
            id="knowledge-top-k"
            inputMode="numeric"
            value={values.topK}
            aria-invalid={Boolean(errors.topK)}
            aria-describedby={errors.topK ? "knowledge-top-k-error" : undefined}
            onChange={(event) => onChange("topK", event.target.value)}
          />
        </Field>
        <Field id="knowledge-threshold" label="Score threshold" error={errors.scoreThreshold}>
          <Input
            id="knowledge-threshold"
            inputMode="decimal"
            value={values.scoreThreshold}
            aria-invalid={Boolean(errors.scoreThreshold)}
            aria-describedby={errors.scoreThreshold ? "knowledge-threshold-error" : undefined}
            onChange={(event) => onChange("scoreThreshold", event.target.value)}
          />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        Chunk size is a simulated character window. No tokenizer runs, and overlap must stay smaller than the chunk size.
      </p>
      <JSONSchemaEditor id="knowledge-schema" value={values.metadataSchema} onChange={(value) => onChange("metadataSchema", value)} />
      {errors.metadataSchema ? (
        <p role="alert" className="text-xs text-destructive">
          {errors.metadataSchema}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  )
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
