-- CMS pages, revisions, and media assets
CREATE TABLE IF NOT EXISTS "pages" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "template_key" TEXT,
  "blocks" JSONB NOT NULL,
  "seo" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMP(3),
  CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pages_slug_key" ON "pages"("slug");

CREATE TABLE IF NOT EXISTS "page_revisions" (
  "id" TEXT NOT NULL,
  "page_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "blocks" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "page_revisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "page_revisions_page_id_version_key" ON "page_revisions"("page_id", "version");
CREATE INDEX IF NOT EXISTS "page_revisions_page_id_idx" ON "page_revisions"("page_id");

ALTER TABLE "page_revisions"
ADD CONSTRAINT "page_revisions_page_id_fkey"
FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "media_assets" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "public_id" TEXT,
  "resource_type" TEXT,
  "folder" TEXT,
  "file_name" TEXT,
  "bytes" INTEGER,
  "width" INTEGER,
  "height" INTEGER,
  "format" TEXT,
  "alt_text" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "media_assets_provider_idx" ON "media_assets"("provider");
