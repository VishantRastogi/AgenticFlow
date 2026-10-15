import { playgroundModels, providers } from "@/features/playground/catalog"
import { cn } from "@/lib/utils"

export function AIModelSelector({
  provider,
  model,
  onProviderChange,
  onModelChange,
  disabled = false,
}: {
  provider: string
  model: string
  onProviderChange: (provider: string) => void
  onModelChange: (model: string) => void
  disabled?: boolean
}) {
  const models = playgroundModels.filter((item) => item.provider === provider)

  return (
    <div className="grid gap-3">
      <label className="grid gap-1.5 text-sm font-medium">
        Provider
        <select
          value={provider}
          disabled={disabled}
          onChange={(event) => onProviderChange(event.target.value)}
          className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          {providers().map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Model
        <select
          value={model}
          disabled={disabled}
          onChange={(event) => onModelChange(event.target.value)}
          className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          {models.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

export function ModelConfigurationPanel({
  temperature,
  maxTokens,
  retrieval,
  onTemperatureChange,
  onMaxTokensChange,
  onRetrievalChange,
  disabled = false,
}: {
  temperature: number
  maxTokens: number
  retrieval: boolean
  onTemperatureChange: (value: number) => void
  onMaxTokensChange: (value: number) => void
  onRetrievalChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <fieldset className="grid gap-3" disabled={disabled}>
      <legend className="text-sm font-medium">Model configuration</legend>
      <label className="grid gap-1.5 text-sm">
        Temperature
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={temperature}
          aria-valuetext={temperature.toFixed(1)}
          onChange={(event) => onTemperatureChange(Number(event.target.value))}
        />
        <span className="text-xs text-muted-foreground">{temperature.toFixed(1)}</span>
      </label>
      <label className="grid gap-1.5 text-sm">
        Output tokens
        <input
          type="number"
          min={16}
          max={4096}
          value={maxTokens}
          onChange={(event) => onMaxTokensChange(Number(event.target.value))}
          className="h-10 rounded-lg border border-input bg-transparent px-2.5"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={retrieval} onChange={(event) => onRetrievalChange(event.target.checked)} />
        Use retrieval
      </label>
    </fieldset>
  )
}

export function TokenUsageBadge({
  promptTokens,
  completionTokens,
}: {
  promptTokens: number
  completionTokens: number
}) {
  return (
    <p className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
      Tokens {promptTokens} in · {completionTokens} out
    </p>
  )
}

export function CostIndicator({ amount }: { amount: number }) {
  return (
    <p className="text-xs text-muted-foreground">
      Estimated cost ${amount.toFixed(6)}
      <span className="sr-only"> from the mock price card</span>
    </p>
  )
}

export function PromptEditor({
  id,
  label,
  value,
  onChange,
  disabled = false,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <label htmlFor={id} className="grid gap-1.5 text-sm font-medium">
      {label}
      <textarea
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm font-normal"
      />
    </label>
  )
}

export function GuardrailConfiguration({
  refuseSecrets,
  citeSources,
  onRefuseSecretsChange,
  onCiteSourcesChange,
  disabled = false,
}: {
  refuseSecrets: boolean
  citeSources: boolean
  onRefuseSecretsChange: (value: boolean) => void
  onCiteSourcesChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="text-sm font-medium">Guardrails</legend>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={refuseSecrets} onChange={(event) => onRefuseSecretsChange(event.target.checked)} />
        Refuse credential-shaped text
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={citeSources} onChange={(event) => onCiteSourcesChange(event.target.checked)} />
        Prefer cited sources
      </label>
    </fieldset>
  )
}

export function panelClass(className?: string) {
  return cn("rounded-xl border border-border bg-card p-3", className)
}
