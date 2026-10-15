import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { AIModelSelector, PromptEditor } from "@/components/ai/model-controls"
import { CitationCard } from "@/components/ai/messages"
import { DocumentUploadZone, EvaluationScoreCard, JSONSchemaEditor, KnowledgeBaseSelector } from "@/components/ai/studio"

describe("AI component library", () => {
  it("exposes model, prompt, citation, and score controls", async () => {
    const user = userEvent.setup()
    const onModelChange = vi.fn()
    render(
      <div>
        <AIModelSelector
          provider="AgentFlow Simulated"
          model="orbit-small"
          onProviderChange={() => undefined}
          onModelChange={onModelChange}
        />
        <PromptEditor id="prompt" label="System prompt" value="" onChange={() => undefined} />
        <CitationCard
          citation={{
            id: "cite_1",
            document: "Handbook",
            chunkId: "chunk_1",
            score: 0.5,
            excerpt: "A grounded excerpt.",
          }}
        />
        <EvaluationScoreCard label="Groundedness" score={0.4} threshold={0.8} simulated />
        <KnowledgeBaseSelector value="" options={[]} onChange={() => undefined} />
        <JSONSchemaEditor id="schema" value="[]" onChange={() => undefined} />
        <DocumentUploadZone onFiles={() => undefined} />
      </div>,
    )

    expect(screen.getByLabelText("Model")).toHaveValue("orbit-small")
    expect(screen.getByLabelText("System prompt")).toBeInTheDocument()
    expect(screen.getByLabelText("Citation Handbook")).toBeInTheDocument()
    expect(screen.getByLabelText("Groundedness")).toHaveTextContent("Simulated score")
    expect(screen.getByLabelText("Knowledge base")).toBeInTheDocument()
    expect(screen.getByText("Enter a JSON object.")).toBeInTheDocument()
    await user.click(screen.getByLabelText("Model"))
    expect(onModelChange).not.toHaveBeenCalled()
  })
})