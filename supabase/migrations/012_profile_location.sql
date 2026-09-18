-- Migration 012: Add location columns to profiles for live map feature
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lat  double precision,
  ADD COLUMN IF NOT EXISTS lng  double precision,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;
