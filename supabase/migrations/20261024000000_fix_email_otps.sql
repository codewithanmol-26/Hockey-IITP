-- Fixes e-mail sign-up codes. The server stores the code hash, e-mail, expiry,
-- wrong-try count and send limits, but login_otps only had id/hash/created_at,
-- so every "Send code" failed after the e-mail was already sent.

ALTER TABLE public.login_otps
  ADD COLUMN IF NOT EXISTS email      TEXT,
  ADD COLUMN IF NOT EXISTS expires_at BIGINT  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tries      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sent_at    BIGINT  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hour_start BIGINT  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sends      INTEGER DEFAULT 0;

-- Remembers that the player proved they own the e-mail address.
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
