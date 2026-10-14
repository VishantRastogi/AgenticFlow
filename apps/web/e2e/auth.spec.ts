import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { signIn } from "./helpers"

test("signs in with the mock account and opens the console", async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible()
})

test("shows invalid credentials without opening the console", async ({ page }) => {
  await page.goto("/login")
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
  await page.getByLabel("Email").fill("ada@agentflow.test")
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("wrong-password")
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

test("shows a network failure for the reserved mock address", async ({ page }) => {
  await page.goto("/login")
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
  await page.getByLabel("Email").fill("network@agentflow.test")
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("orbit-7481")
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "could not be reached" })).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

test("sign-in has no critical accessibility violations", async ({ page }) => {
  await page.goto("/login")
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
  await page.locator("#login-title").evaluate(async (title) => {
    const target = title.closest("form")?.parentElement
    if (!target) return
    const deadline = performance.now() + 1500
    while (performance.now() < deadline) {
      if (Number(getComputedStyle(target).opacity) >= 0.99) return
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
    }
  })
  const results = await new AxeBuilder({ page }).analyze()
  const blocking = results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious")
  expect(blocking.map((violation) => violation.id)).toEqual([])
})
