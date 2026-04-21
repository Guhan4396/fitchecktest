-- Remove old skin_tone and body_type check constraints (new categories are different)
ALTER TABLE public.style_profiles
  DROP CONSTRAINT IF EXISTS style_profiles_skin_tone_check,
  DROP CONSTRAINT IF EXISTS style_profiles_body_type_check;

-- Add new columns
ALTER TABLE public.style_profiles
  ADD COLUMN IF NOT EXISTS undertone text not null default '',
  ADD COLUMN IF NOT EXISTS face_shape text not null default '',
  ADD COLUMN IF NOT EXISTS best_necklines text not null default '',
  ADD COLUMN IF NOT EXISTS best_fits text not null default '',
  ADD COLUMN IF NOT EXISTS colors_that_work text[] not null default '{}',
  ADD COLUMN IF NOT EXISTS colors_to_avoid text[] not null default '{}';
