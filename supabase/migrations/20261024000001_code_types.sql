-- Lets each player choose how they lock their account: alphanumeric, numeric PIN or pattern.
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS code_type TEXT DEFAULT 'alnum';
