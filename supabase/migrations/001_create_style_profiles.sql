-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Style profiles table
create table if not exists public.style_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skin_tone text not null check (skin_tone in ('fair', 'light', 'medium', 'olive', 'brown', 'dark')),
  body_type text not null check (body_type in ('hourglass', 'pear', 'apple', 'rectangle', 'inverted_triangle')),
  skin_tone_description text not null default '',
  body_type_description text not null default '',
  style_notes text not null default '',
  profile_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

-- RLS policies
alter table public.style_profiles enable row level security;

-- Users can only read their own profile
create policy "Users can view own profile"
  on public.style_profiles for select
  using (auth.uid() = user_id);

-- Users can insert their own profile
create policy "Users can insert own profile"
  on public.style_profiles for insert
  with check (auth.uid() = user_id);

-- Users can update their own profile
create policy "Users can update own profile"
  on public.style_profiles for update
  using (auth.uid() = user_id);

-- Storage bucket for profile images
insert into storage.buckets (id, name, public)
values ('profile-images', 'profile-images', true)
on conflict do nothing;

-- Storage policies
create policy "Users can upload their own profile images"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-images' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Profile images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'profile-images');

create policy "Users can update their own profile images"
  on storage.objects for update
  using (
    bucket_id = 'profile-images' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
