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

-- Migration: add 'draft' to analysis_status check constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'photo_product_metadata_analysis_status_check'
  ) THEN
    ALTER TABLE photo_product_metadata DROP CONSTRAINT photo_product_metadata_analysis_status_check;
  END IF;
END $$;
ALTER TABLE photo_product_metadata ADD CONSTRAINT photo_product_metadata_analysis_status_check
  CHECK (analysis_status IN ('draft', 'pending', 'running', 'succeeded', 'failed', 'confirmed'));
ALTER TABLE photo_product_metadata ALTER COLUMN analysis_status SET DEFAULT 'draft';

-- Migration: migrate existing share_documents status before adding new constraint
UPDATE share_documents SET status = 'completed' WHERE status NOT IN ('pending', 'analyzing', 'generating', 'completed', 'failed');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'share_documents_status_check'
  ) THEN
    ALTER TABLE share_documents DROP CONSTRAINT share_documents_status_check;
  END IF;
END $$;
ALTER TABLE share_documents ADD COLUMN IF NOT EXISTS unified_moq INTEGER NULL;
ALTER TABLE share_documents ADD COLUMN IF NOT EXISTS export_progress INTEGER NOT NULL DEFAULT 0;
ALTER TABLE share_documents ADD COLUMN IF NOT EXISTS export_file_path TEXT NULL;
ALTER TABLE share_documents ADD COLUMN IF NOT EXISTS export_error TEXT NULL;
ALTER TABLE share_documents ADD COLUMN IF NOT EXISTS export_started_at TIMESTAMPTZ NULL;
ALTER TABLE share_documents ADD COLUMN IF NOT EXISTS export_completed_at TIMESTAMPTZ NULL;
ALTER TABLE share_documents ADD CONSTRAINT share_documents_status_check
  CHECK (status IN ('pending', 'analyzing', 'generating', 'completed', 'failed'));
ALTER TABLE share_documents ALTER COLUMN status SET DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS share_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id),
  template_version TEXT NOT NULL DEFAULT 'v1',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'generating', 'completed', 'failed')),
  unified_moq INTEGER NULL,
  export_progress INTEGER NOT NULL DEFAULT 0,
  export_file_path TEXT NULL,
  export_error TEXT NULL,
  export_started_at TIMESTAMPTZ NULL,
  export_completed_at TIMESTAMPTZ NULL,
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
