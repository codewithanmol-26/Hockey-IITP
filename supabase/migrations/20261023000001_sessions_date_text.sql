-- Migration: Support multi-session identifiers on the same calendar day (e.g. 2026-01-29_2)
-- Changes sessions.date column from DATE to TEXT to allow suffixes like "_2" or "-2"

ALTER TABLE public.sessions ALTER COLUMN date TYPE TEXT;
