create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  ig_user_id text unique not null,
  username text not null,
  profile_picture_url text,
  account_type text,
  token_enc text not null,
  token_expires_at timestamptz not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  caption text not null default '',
  media_type text not null check (media_type in ('IMAGE','REELS')),
  media_url text not null,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled',
  attempts int not null default 0,
  locked_at timestamptz,
  container_id text,
  ig_media_id text,
  permalink text,
  last_error text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists posts_due_idx on posts (status, scheduled_at);
create index if not exists posts_account_idx on posts (account_id);

create table if not exists follower_snapshots (
  account_id uuid not null references accounts(id) on delete cascade,
  day date not null,
  followers int,
  media_count int,
  primary key (account_id, day)
);

-- Editor templates: shared by every browser and teammate
create table if not exists templates (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  video_url text,
  video_path text,
  video_type text,
  added bigint,
  updated_at timestamptz not null default now()
);

create table if not exists editor_config (
  id int primary key default 1,
  data jsonb not null default '{}'::jsonb,
  font_url text,
  font_path text,
  font_type text,
  constraint editor_config_single_row check (id = 1)
);

