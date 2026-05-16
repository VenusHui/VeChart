# Repository Guidelines

## Project Structure & Module Organization
This repository is a TypeScript monorepo with two workspaces:
- `apps/web`: Next.js frontend (`app/`, `components/`, `lib/`, `public/`)
- `apps/api`: NestJS backend (`src/modules`, `src/data`, `src/common`)

Supporting files live in:
- `infra/sql`: database schema and SQL assets
- `scripts`: operational scripts such as remote DB initialization
- `docs`: PRD, technical plans, and product notes
- `.omx`: OMX runtime state; treat as generated workspace metadata unless a task explicitly targets it

## Build, Test, and Development Commands
Run commands from the repository root:
- `npm run dev:web` — start the Next.js app locally
- `npm run dev:api` — start the NestJS API in watch mode
- `npm run build:web` — production build for the frontend
- `npm run build:api` — compile the backend to `apps/api/dist`
- `npm run lint:web` — TypeScript check for the frontend
- `npm run lint:api` — TypeScript check for the backend
- `npm run check` — build API then web; use before handoff
- `docker compose up --build` — run the local container stack

## Coding Style & Naming Conventions
Use TypeScript throughout. Follow the existing code style:
- 2-space indentation
- `PascalCase` for React components and Nest providers/classes
- `camelCase` for functions, variables, and helpers
- Keep route and feature files close to their module (`apps/web/app/albums`, `apps/api/src/modules/share-documents`)

There is no separate formatter config in this checkout; rely on consistent manual formatting and `tsc --noEmit` to catch structural issues.

## Testing Guidelines
There is currently no dedicated Jest/Vitest suite in the repo. Minimum verification is:
- run `npm run lint:web`
- run `npm run lint:api`
- run `npm run check`

When adding tests, colocate them with the feature and use `*.test.ts` or `*.spec.ts` naming.

## Commit & Pull Request Guidelines
This checkout does not include Git history, so no repository-specific commit pattern can be inferred from local logs. Use short imperative commit subjects (for example, `Improve share document export layout`). If you use OMX workflows, include structured rationale in the commit body.

PRs should include: purpose, affected areas, config or schema changes, manual verification steps, and screenshots/GIFs for UI updates.

## Security & Configuration Tips
Never commit real secrets. Keep environment values in local `.env` or `.docker.env` files, and double-check COS/PostgreSQL settings before deploying.
