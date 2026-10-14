import { expect, test } from "@playwright/test"

test.use({ viewport: { width: 390, height: 844 } })

test("keeps sign-in usable on a narrow viewport", async ({ page }) => {
  await page.goto("/login")
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
  await expect(page.getByLabel("Email")).toBeVisible()
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 8)
  expect(overflow).toBe(false)
})
