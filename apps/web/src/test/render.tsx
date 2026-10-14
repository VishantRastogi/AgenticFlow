import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, type RenderOptions } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeProvider } from "@/providers/theme-provider"

export function renderWithProviders(ui: React.ReactElement, options?: RenderOptions) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(ui, {
    wrapper: ({ children }) => (
      <ThemeProvider>
        <QueryClientProvider client={client}>
          <TooltipProvider>{children}</TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    ),
    ...options,
  })
}
