# Quality audit

Audit of the Mission Control web app at Next.js 16.4.0, React 19.3.0, Turbopack, and `strict` TypeScript. Bundle numbers below are from `npm run build:web` in this phase.

## TypeScript

`apps/web/tsconfig.json` has `strict: true`, `isolatedModules`, and `noEmit`. The app typechecks with `tsc --noEmit`.

These stricter flags are off:

- `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes`
- `noUnusedLocals` / `noUnusedParameters` (ESLint covers unused locals through the Next.js config)

Turning `noUncheckedIndexedAccess` on would touch indexing across charts, catalogs, and mock stores. It is a follow-up, not a gap in the `strict` flag that is already enabled. The real API adapter and the operation catalog are typed so a misspelled operation id fails compilation.

## Bundles

`next build` (Turbopack, Next.js 16.4.0) completed for 19 routes. This version does not print the older First Load JS table, so sizes below are measured from `apps/web/.next/static` after that build. The whole static directory is 2.8 MB. These are shared client chunks, not per-route First Load totals, and they are not Module Federation chunks.

| Chunk | Size |
| --- | --- |
| `1zzu8e5azud_j.js` | 356 KB |
| `1_z3y9tgz22sn.js` | 232 KB |
| `3ybdik5hp57zo.js` | 188 KB |
| `3fkskeevkw7j5.js` | 184 KB |
| `09t549do_5zvv.js` | 164 KB |
| `0ywkfest9y19z.js` | 136 KB |
| `0cz1d0mv5g_q7.js` | 112 KB |
| `0qlmjfi46r46v.js` | 104 KB |

The remaining chunks are 72 KB or smaller. Dynamic routes are `/agents/[id]`, `/deployments/[id]`, `/executions/[id]`, and `/workflows/[id]/edit`. The other pages are static. Shared client chunks stay on the Next.js origin. The federation host and remote are separate Webpack builds and are not part of this table.

## Animation

Framer Motion is the default for page sections, lists, and chart enter states. `MotionConfig` uses `reducedMotion="user"`. Screens that also check `usePrefersReducedMotion` pass `duration: 0` or `initial={false}` when the user prefers reduced motion. That hook reads the media query after mount, so the first painted frame can still fade. The sign-in accessibility scan waits until that fade reaches full opacity before measuring contrast.

GSAP is limited to sequences that coordinate more than one element:

- Brand mark entrance (finite timeline)
- Login orbital field (transform rotation, 22–46s, `repeat: -1`, login route only)
- Dashboard header accent
- Workflow test-run playback
- Deployment pipeline playback

Each of those bails out when `prefers-reduced-motion: reduce` matches. The orbital field is the only infinite animation, and it animates `transform` only. Recharts area and pie charts set `isAnimationActive` from the same reduced-motion flag. Vitest sets an instant path where a test would otherwise wait on a timeline.

GSAP and Framer Motion are not applied to the same properties on those sequences.

## Accessibility

- Console pages keep an `h1` mounted during loading. The workflow editor's `h1` is visually hidden and mirrors the name field.
- Auth, agent, settings, and filter fields are labeled. Icon-only actions (undo, redo, sidebar, account) have accessible names.
- Errors use `role="alert"` or `ErrorState`.
- Status is text plus color, not color alone (`StatusBadge` includes a label).
- Playwright covers sign-in, agent create, workflow editing, and execution detail with the keyboard-reachable roles those flows expose. The sign-in scan runs axe-core with reduced motion so the entrance fade is not measured as low contrast.
- Inline auth links that sit in a sentence are underlined so they are not identified by color alone.
- This pass did not run a full contrast matrix across every console route. Theme tokens are the existing dark default and light palette. A contrast failure found by an automated scan should be fixed in the token, not by a one-off color on a single screen.

## Responsive behavior

The shell collapses the sidebar below the large breakpoint and exposes Open navigation. Workflow canvas controls for Nodes and Properties are available on narrow viewports. Settings and analytics forms stack instead of requiring a horizontal scroll.

Playwright checks the sign-in form at 390×844 and fails if the document is wider than the viewport. Desktop flows cover agents, workflows, and executions.

## Mock behavior covered by tests

Vitest plus MSW checks:

- Real mode with no origin does not call `fetch`.
- Real mode with an unreachable origin does not use the mock.
- A 404 from the real origin names the operation (`auth.login`) and says mock mode was not used.
- `executions.stream` throws before `fetch`.
- A created agent is still returned by the next list read (local mock persistence).
- Creating an agent invalidates the TanStack Query list so the new row appears without a manual cache write.
- Existing agent, workflow, execution, and auth tests still cover network failures, invalid transitions, and validation errors.

Playwright repeats the signed-in paths in a browser: authentication, agent persistence across reload, workflow editing, and opening an execution.
