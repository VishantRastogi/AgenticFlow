# Module Federation and the AgentFlow shell

This note records the bundler that Mission Control actually uses, why Module Federation is not enabled inside it, and how the isolated Webpack proof demonstrates the model we would use later.

## What is installed

| Piece | Value |
| --- | --- |
| Next.js | 16.4.0 (`apps/web/package.json`) |
| React | 19.3.0 |
| Bundler | Turbopack, the Next.js 16 default for `next dev` and `next build` |
| Router | App Router (`apps/web/src/app`) |
| Webpack config | None. `next.config.ts` only sets a Turbopack alias so `msw/browser` resolves. |

Next.js 16 documents Turbopack as the default bundler. A custom `webpack` function in `next.config` makes `next build` fail unless the build is opted back to Webpack with `--webpack`. Opting the Mission Control app out of Turbopack, or replacing the App Router with the Pages Router, would be a compatibility workaround. This phase does not do that.

## What the federation docs allow

Authoritative sources checked before choosing an approach:

- [Module Federation — Next.js integration](https://module-federation.io/integrations/framework/nextjs/) states **App Router Not Supported**. The plugin supports Next.js 12–15 on the **Pages Router**. The same page says Next.js support is ending.
- [module-federation/core#3153](https://github.com/module-federation/core/issues/3153) records that `@module-federation/nextjs-mf` is in maintenance and that the plugin fails a build when it detects an `app` directory.
- [Next.js Turbopack reference](https://nextjs.org/docs/app/api-reference/turbopack) describes Turbopack as the default. It does not document a supported `ModuleFederationPlugin` configuration for this app.
- Installed `next@16.4.0` type declarations contain no `moduleFederation` config. Unreleased Turbopack federation work exists in Next.js pull requests, but it is not a published API of the version this repo installs.

`@module-federation/nextjs-mf` was not added. The App Router stays in place.

## The proof

`proofs/module-federation` is a separate Webpack 5 package. It is not an npm workspace and it is not imported by `apps/web`.

- **Remote** (`agentflow_remote`) exposes `./AgentHealthCard`, a React component that uses `useState`. Its production `publicPath` is `http://127.0.0.1:3101/`, so its chunks stay on the remote origin.
- **Host** (`agentflow_host`) loads `agentflow_remote@http://127.0.0.1:3101/remoteEntry.js`. React and React DOM are shared as singletons at `^19.3.0`.
- The host renders `Loading the remote feature…` before it imports the remote, and keeps that status up for 300ms so the fallback is observable. It then shows an alert if `remoteEntry.js` fails.
- Each app has its own production build and its own static server.

```bash
cd proofs/module-federation
npm install
npm run verify
```

`verify` builds both apps, serves them on ports 3101 and 3100, checks that the host bundle does not contain the remote copy, confirms both sides report the same React version, toggles the remote card, opens the remote by itself, then aborts `remoteEntry.js` and expects the host error fallback.

## How this could meet the shell later

When Next.js publishes a supported App Router federation API for the installed major version, a remote could expose a client component such as the agent health card. The shell would:

1. Keep routing, auth, and the session gate in the Next.js host.
2. Load the remote only from a Client Component, behind `React.lazy` and an error boundary. Server Components must not import the remote.
3. Share one React, React DOM, and JSX runtime. A second React copy breaks hooks.
4. Treat the remote origin as configuration (`NEXT_PUBLIC_FEDERATION_REMOTE`), with the same explicit failure used by `NEXT_PUBLIC_API_MODE=real`: if the remote is missing, the shell renders the fallback and does not substitute mock UI.
5. Deploy the remote on its own origin and cache-bust `remoteEntry.js` independently of the shell release.

Until that API exists, federation stays in `proofs/module-federation`.

## Limitations

- The proof is client-only. It does not do RSC, SSR, or Next.js routing.
- Shared singletons are React and React DOM only. TanStack Query, theme state, and the auth token are not shared.
- The remote URL is fixed at build time. A runtime URL would need the Module Federation runtime API, which this proof does not use.
- The host and remote must agree on the React 19 major. The `requiredVersion` check is `^19.3.0`.
- CORS is opened with `Access-Control-Allow-Origin: *` on the proof's static server. A production remote would allow only the shell origin.
- Loading the proof into the Next.js shell today would require either an unsupported plugin or an iframe. Neither is implemented.
