# AgenticFlow

Mission Control monorepo. The implemented application is the Next.js console in `apps/web`. The Express package that previously sat at the repository root now lives in `apps/api-gateway`.

```
agentflow/
├── apps/
│   ├── web/                      Next.js frontend
│   └── api-gateway/              GraphQL API gateway
├── services/
│   ├── auth-service/
│   ├── agent-service/
│   ├── workflow-service/
│   ├── execution-service/
│   └── notification-service/
├── packages/
│   ├── shared-types/
│   ├── api-contracts/
│   ├── logger/
│   └── config/
├── infra/
│   ├── docker/
│   ├── kubernetes/
│   └── terraform/
├── docs/
│   ├── architecture/
│   └── api-contracts/
├── docker-compose.yml
├── package.json
├── tsconfig.base.json
└── turbo.json
```

Gateway compiler config is `apps/api-gateway/tsconfig.json`.

## Frontend

```bash
npm run dev:web
npm run lint:web
npm run typecheck:web
npm run test:web
npm run build:web
```

`apps/api-gateway` holds the Express dependencies and scripts (`dev`, `build`, `start`, `typecheck`). There is no `src/server.ts` yet, so those scripts have nothing to run. The service, package, and infrastructure directories are reserved.
