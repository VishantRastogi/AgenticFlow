import { expect, test } from "@playwright/test"
import { signIn } from "./helpers"

test("retrieves a ready document in RAG studio", async ({ page }) => {
  await signIn(page, "/knowledge-bases/new")
  await page.getByLabel("Name").fill("Handbook")
  await page.getByRole("button", { name: "Create knowledge base" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Handbook" })).toBeVisible()
  await page.getByLabel("Upload documents").setInputFiles({
    name: "notes.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# notes"),
  })
  await page.getByRole("link", { name: "notes.md" }).click()
  await expect(page.getByText("Ingestion status: Ready. Simulated pipeline.")).toBeVisible({ timeout: 20_000 })

  await page.goto("/rag-studio")
  await expect(page.getByRole("heading", { level: 1, name: "RAG Studio" })).toBeVisible()
  await expect(page.getByText(/do not call a model/i)).toBeVisible()
  await page.getByLabel("Knowledge base").selectOption({ label: "Handbook" })
  await page.getByLabel("Search query").fill("notes")
  await page.getByRole("button", { name: "Run retrieval" }).click()
  await expect(page.getByText(/Simulated retrieval/)).toBeVisible()
  await expect(page.getByText("notes.md").first()).toBeVisible()
  await expect(page.getByText(/not produced by a model/i)).toBeVisible()
})

test("keeps RAG studio usable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, "/rag-studio")
  await expect(page.getByRole("heading", { level: 1, name: "RAG Studio" })).toBeVisible()
  await page.getByRole("button", { name: "Configuration" }).click()
  await expect(page.getByLabel("Search query")).toBeVisible()
  await page.getByRole("button", { name: "Inspector" }).click()
  await expect(page.getByRole("region", { name: "RAG inspector" })).toBeVisible()
})
