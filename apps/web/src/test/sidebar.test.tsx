import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AppSidebar } from "@/components/shell/app-sidebar"
import { moduleList } from "@/lib/modules"
import { renderWithProviders } from "@/test/render"
import { useUiStore } from "@/stores/ui-store"

vi.mock("next/navigation", () => ({
  usePathname: () => "/overview",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

describe("sidebar", () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ""
    delete document.documentElement.dataset.sidebar
    useUiStore.setState({
      sidebarCollapsed: false,
      commandOpen: false,
      mobileNavOpen: false,
      hydrated: true,
    })
  })

  it("links every destination and collapses", async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppSidebar />)

    const navigation = screen.getByRole("navigation", { name: "Primary" })
    expect(navigation).toHaveAttribute("data-collapsed", "false")

    for (const item of moduleList()) {
      expect(screen.getByRole("link", { name: item.title })).toHaveAttribute("href", item.href)
    }

    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page")

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }))

    expect(navigation).toHaveAttribute("data-collapsed", "true")
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-pressed", "true")
    expect(document.documentElement.dataset.sidebar).toBe("collapsed")
  })
})
