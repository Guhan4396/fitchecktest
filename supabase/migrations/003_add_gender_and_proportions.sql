-- Add gender, proportions, and clothing_recommendations columns
ALTER TABLE public.style_profiles
  ADD COLUMN IF NOT EXISTS gender text not null default 'men',
  ADD COLUMN IF NOT EXISTS proportions text not null default '',
  ADD COLUMN IF NOT EXISTS clothing_recommendations text not null default '';
