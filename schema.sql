-- schema 由 scripts/migrate.js 套用（npm run db:migrate），不再在每次請求裡自動建表
-- 這份檔案是给 Neon/Supabase 的 SQL Editor 手動執行、或自己管理 schema 時用

CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 若要語意搜尋，再開 pgvector（Neon 支援，Supabase 支援）
-- CREATE EXTENSION IF NOT EXISTS vector;
-- CREATE TABLE IF NOT EXISTS docs (
--   id BIGSERIAL PRIMARY KEY,
--   content TEXT,
--   embedding vector(1024)
-- );
