-- Announcements: tagged people, "show until" deadline and author id.
-- The first migration left these out, so tagging and deadlines were silently dropped.
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS tags     JSONB  DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS until_ms BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS by_id    TEXT;
