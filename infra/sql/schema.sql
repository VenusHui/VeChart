CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor')),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS albums (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  cover_photo_id TEXT NULL,
  created_by TEXT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  album_id TEXT NOT NULL REFERENCES albums(id),
  storage_key_original TEXT NOT NULL,
  storage_key_thumbnail TEXT NOT NULL,
  storage_key_preview TEXT NOT NULL,
  width INTEGER NULL,
  height INTEGER NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS photo_product_metadata (
  photo_id TEXT PRIMARY KEY REFERENCES photos(id),
  product_name TEXT NULL,
  material TEXT NULL,
  product_url TEXT NULL,
  supplier_1688_url TEXT NULL,
  market_price NUMERIC(12, 2) NULL,
  estimated_cost NUMERIC(12, 2) NULL,
  moq INTEGER NULL,
  note TEXT NOT NULL DEFAULT '',
  analysis_status TEXT NOT NULL DEFAULT 'confirmed' CHECK (analysis_status IN ('pending', 'running', 'succeeded', 'failed', 'confirmed')),
  analysis_provider TEXT NULL,
  analysis_confidence TEXT NULL CHECK (analysis_confidence IN ('low', 'medium', 'high')),
  analysis_summary TEXT NULL,
  analysis_sources_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  analysis_error TEXT NULL,
  analysis_snapshot_json JSONB NULL,
  suggested_metadata_json JSONB NULL,
  analysis_updated_at TIMESTAMPTZ NULL,
  updated_by TEXT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE photo_product_metadata ALTER COLUMN product_name DROP NOT NULL;
ALTER TABLE photo_product_metadata ALTER COLUMN material DROP NOT NULL;
ALTER TABLE photo_product_metadata ALTER COLUMN product_url DROP NOT NULL;
ALTER TABLE photo_product_metadata ALTER COLUMN supplier_1688_url DROP NOT NULL;
ALTER TABLE photo_product_metadata ALTER COLUMN market_price DROP NOT NULL;
ALTER TABLE photo_product_metadata ALTER COLUMN estimated_cost DROP NOT NULL;
ALTER TABLE photo_product_metadata ALTER COLUMN moq DROP NOT NULL;
ALTER TABLE photo_product_metadata ADD COLUMN IF NOT EXISTS analysis_status TEXT NOT NULL DEFAULT 'confirmed';
ALTER TABLE photo_product_metadata ADD COLUMN IF NOT EXISTS analysis_provider TEXT NULL;
ALTER TABLE photo_product_metadata ADD COLUMN IF NOT EXISTS analysis_confidence TEXT NULL;
ALTER TABLE photo_product_metadata ADD COLUMN IF NOT EXISTS analysis_summary TEXT NULL;
ALTER TABLE photo_product_metadata ADD COLUMN IF NOT EXISTS analysis_sources_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE photo_product_metadata ADD COLUMN IF NOT EXISTS analysis_error TEXT NULL;
ALTER TABLE photo_product_metadata ADD COLUMN IF NOT EXISTS analysis_snapshot_json JSONB NULL;
ALTER TABLE photo_product_metadata ADD COLUMN IF NOT EXISTS suggested_metadata_json JSONB NULL;
ALTER TABLE photo_product_metadata ADD COLUMN IF NOT EXISTS analysis_updated_at TIMESTAMPTZ NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'photo_product_metadata_analysis_status_check'
  ) THEN
    ALTER TABLE photo_product_metadata
      ADD CONSTRAINT photo_product_metadata_analysis_status_check
      CHECK (analysis_status IN ('pending', 'running', 'succeeded', 'failed', 'confirmed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'photo_product_metadata_analysis_confidence_check'
  ) THEN
    ALTER TABLE photo_product_metadata
      ADD CONSTRAINT photo_product_metadata_analysis_confidence_check
      CHECK (analysis_confidence IN ('low', 'medium', 'high'));
  END IF;
END $$;

UPDATE photo_product_metadata
SET analysis_status = 'confirmed',
    analysis_updated_at = COALESCE(analysis_updated_at, updated_at)
WHERE analysis_status IS NULL OR analysis_status = '';

CREATE TABLE IF NOT EXISTS share_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id),
  template_version TEXT NOT NULL DEFAULT 'v1',
  status TEXT NOT NULL DEFAULT 'ready',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS share_document_items (
  id TEXT PRIMARY KEY,
  share_document_id TEXT NOT NULL REFERENCES share_documents(id),
  photo_id TEXT NOT NULL REFERENCES photos(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  snapshot_json JSONB NOT NULL
);
