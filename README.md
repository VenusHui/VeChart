# VeChart

Cloud album and share-document MVP for product imagery.

## Apps

- `apps/web`: Next.js responsive frontend
- `apps/api`: NestJS API

## Run

1. Install dependencies with `npm install`
2. Start API with `npm run dev:api`
3. Start web with `npm run dev:web`

## Docker

- Web: `http://localhost:3001`
- API: `http://localhost:4000/api`
- First initialize remote DB with `node scripts/init-remote-db.mjs` or let the API container do it on startup

## Demo accounts

- `admin@vechart.local` / `admin123`
- `editor@vechart.local` / `editor123`

## Notes

- The current implementation uses seeded in-memory data stores to keep the MVP runnable without external services.
- `infra/sql/schema.sql` documents the target PostgreSQL schema for production implementation.
- PDF export is represented by a service contract and an HTML/print-friendly share page; production export should use Playwright on the API side.
