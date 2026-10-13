import { render, type RenderOptions } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeProvider } from "@/providers/theme-provider"

export function renderWithProviders(ui: React.ReactElement, options?: RenderOptions) {
  return render(ui, {
    wrapper: ({ children }) => (
      <ThemeProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </ThemeProvider>
    ),
    ...options,
  })
}
