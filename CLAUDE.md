# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev:web` — Next.js dev server
- `npm run dev:api` — NestJS in watch mode
- `npm run build:web` / `npm run build:api` — production builds
- `npm run lint:web` / `npm run lint:api` — `tsc --noEmit` type-check
- `npm run check` — build API then web (use as pre-handoff verification)
- `node scripts/init-remote-db.mjs` — initialize remote PostgreSQL with schema + seed data
- `docker compose up --build` — full container stack (API on :4000, web on :3001)

No test suite exists yet. Verification is `lint:web` + `lint:api` + `check`.

## Architecture

TypeScript monorepo with npm workspaces: `apps/web` (Next.js 15 App Router) and `apps/api` (NestJS 10). The system is a product cloud album app — organize product photos into albums, attach structured metadata, generate share documents, and optionally run AI photo analysis.

### Persistence

PostgreSQL via raw SQL queries — no ORM. `PostgresService` wraps a `pg.Pool`. All queries live in `PostgresRepository` (`apps/api/src/data/postgres.repository.ts`). Repository methods return typed records from `apps/api/src/common/types.ts`. Column names are camelCased with double-quoted aliases in SQL SELECTs.

### Authentication

Cookie-based JWT. `AuthModule` uses `@nestjs/jwt` + `passport-jwt`. The JWT secret comes from `JWT_SECRET` env var. CORS in `main.ts` accepts the configured `WEB_ORIGIN`, localhost, and any IP-based origin over HTTP/HTTPS. The frontend `AuthProvider` fetches `/auth/me` on mount and stores user in React context.

### Photo Analysis Pipeline

`PhotoAnalysisService` (`apps/api/src/modules/photos/photo-analysis.service.ts`) runs asynchronously with an in-memory dedup set (`inFlight`). On module init, it picks up any `pending`/`running` photos and retries them. Analysis has a primary/fallback pattern:

1. If `OPENAI_API_KEY` is set: calls OpenAI Responses API with structured JSON schema output and the photo image
2. On failure or if no key: falls back to heuristic analysis (web scraping product URLs, regex extraction of prices/materials)
3. Results go through `sanitizeSuggestedMetadata` which cross-validates against the heuristic output

The heuristic analyzer scrapes the product link and 1688 link, extracts material keywords, prices near price-related terms, and MOQ. Cost estimation uses material-based factor ranges applied to market price.

### Share Documents

Documents snapshot photo metadata at creation time (stored as JSONB in `share_document_items.snapshot_json`) to prevent historical drift. `ShareDocumentsService.exportPptxBuffer` generates PPTX with two visual templates (`default` — dark navy theme, `sales` — warm brown theme) using `pptxgenjs`. Images are fetched and inlined as data URIs. PDF export is a stub returning `print-template-ready`; production should use Playwright.

### COS (Tencent Cloud Object Storage)

`CosStorageService` wraps `@aws-sdk/client-s3` configured for COS endpoint. Used to upload base64 images from the web client into the COS bucket. The `createPhoto` flow in the repository uploads the image to COS first, then inserts the photo record with storage keys.

### Seed Data

Two demo accounts: `admin@vechart.local` / `admin123` (admin) and `editor@vechart.local` / `editor123` (editor). The DB init script creates these plus sample albums ("bags", "pendants") and photos using Unsplash placeholder URLs.

## Conventions

- 2-space indentation, PascalCase for classes/components, camelCase for functions/variables
- Each NestJS module has `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.dto.ts`
- DTOs use `class-validator` decorators; `ValidationPipe` in main.ts enforces whitelist + transform
- Frontend API client is a plain object in `apps/web/lib/api.ts` — methods map 1:1 to endpoints
- Types are duplicated between `apps/web/lib/types.ts` and `apps/api/src/common/types.ts` (no shared package)
- IDs are prefixed strings: `user-`, `album-`, `photo-`, `share-`, `share-item-`, suffixed with `Date.now()`
