-- Migration: Create context_events table
-- Stores user context events (page visits, selections, insights, etc.)

create table if not exists public.context_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('page_visit', 'selection', 'conversation', 'insight', 'file')),
  source text not null,
  data jsonb not null default '{}',
  timestamp timestamptz default now(),
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.context_events enable row level security;

-- Policies: users can only access their own context
create policy "Users can view own context"
  on context_events for select
  using (auth.uid() = user_id);

create policy "Users can insert own context"
  on context_events for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own context"
  on context_events for delete
  using (auth.uid() = user_id);

-- Indexes for efficient queries
create index if not exists context_events_user_timestamp_idx
  on context_events(user_id, timestamp desc);

create index if not exists context_events_user_type_idx
  on context_events(user_id, type);

create index if not exists context_events_user_source_idx
  on context_events(user_id, source);
