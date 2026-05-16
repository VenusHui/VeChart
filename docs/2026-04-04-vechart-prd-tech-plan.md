# VeChart PRD And Technical Plan

## Product Summary

VeChart is a collaborative cloud album for product teams. Logged-in users can organize product images into albums, attach structured product metadata to each image, and generate shareable product documents with a fixed presentation template. The first release targets responsive web on desktop and mobile browsers.

## Goals

- Centralize product imagery and product details in one system.
- Make image browsing usable on desktop and mobile.
- Standardize the outbound presentation format for selected products.
- Keep architecture aligned with a future PostgreSQL + object storage deployment.

## Users And Roles

- `admin`: full system access, user administration, content administration
- `editor`: upload images, edit product metadata, create share documents

All first-release pages require login.

## Core Entities

- `Album`: category container such as Pendant or Bag
- `Photo`: uploaded image record inside an album
- `Photo metadata`: structured product fields attached to one photo
- `Share document`: fixed-template document generated from selected photos

## Required Product Fields

- Product name
- Material
- Product link
- 1688 product link
- Market price
- Estimated cost
- MOQ
- Note

Album cards display product name, material, and market price. Photo detail shows the full field set.

## User Flows

### Album management

1. Login
2. View album list
3. Create or edit an album
4. Open an album to browse photos

### Photo and metadata management

1. Upload one or more product images into an album
2. Review new images marked as incomplete
3. Edit metadata in a detail panel or dedicated mobile page
4. Save and re-check the album grid

### Share document creation

1. Select photos inside an album
2. Create a share document
3. Set title and optional description
4. Preview the fixed template online
5. Export as PDF through the API export contract

## UX Requirements

- Responsive web only for v1
- Grid layout on album pages
- Detail drawer on desktop, dedicated page behavior can be added later on mobile
- Share page optimized for browser print and PDF export

## Technical Architecture

- `apps/web`: Next.js App Router, responsive UI, route protection, API integration
- `apps/api`: NestJS API, JWT auth, album/photo/share endpoints
- Storage abstraction: current in-memory seed data, production target is S3-compatible object storage
- Persistence abstraction: current in-memory repositories, production target is PostgreSQL
- Export abstraction: current placeholder endpoint, production target is Playwright PDF generation

## API Surface

- `POST /auth/login`
- `GET /auth/me`
- `GET /albums`
- `POST /albums`
- `PATCH /albums/:id`
- `GET /albums/:id/photos`
- `POST /albums/:id/photos`
- `PATCH /photos/:id`
- `GET /photos/:id`
- `POST /share-documents`
- `GET /share-documents/:id`
- `POST /share-documents/:id/export-pdf`

## Non-Functional Requirements

- Login-gated access
- URL and number validation on metadata
- Responsive layout from mobile to desktop
- Thumbnail-first browsing pattern
- Share documents store a metadata snapshot to prevent historical drift

## Delivery Notes

- The current repository implementation provides a functional MVP scaffold with seed data.
- Production upgrades should replace the in-memory repositories with PostgreSQL-backed repositories and object-storage-backed upload pipelines.
