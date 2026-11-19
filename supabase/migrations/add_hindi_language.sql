-- =============================================================================
-- Migration: Extend public.profiles.preferred_language to support Hindi ('hi')
-- Allowed values: 'en' (English), 'hi' (Hindi), 'te' (Telugu)
-- Safe & idempotent for existing Supabase databases created with Stage 1 schema.
-- =============================================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_language_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_language_check
  CHECK (preferred_language IN ('en', 'hi', 'te'));
