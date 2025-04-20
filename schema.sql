-- specs table
create table public.spec_documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  title text not null,
  content text not null,
  software_type text,
  deploy_target text,
  created_at timestamptz default now()
);

-- Row Level Security
alter table public.spec_documents enable row level security;

-- Admin can view all documents
create policy "Admins can view all docs" on public.spec_documents
  for select using (auth.uid() = 'admin-uuid' or auth.email() = 't@bonginkan.ai');

-- Users RLS policies
create policy "Users can view own docs" on public.spec_documents for select using (auth.uid() = user_id);
create policy "Users can insert own docs" on public.spec_documents for insert with check (auth.uid() = user_id);
create policy "Users can update own docs" on public.spec_documents for update using (auth.uid() = user_id);
create policy "Users can delete own docs" on public.spec_documents for delete using (auth.uid() = user_id);

-- Add vector search capabilities
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE spec_documents ADD COLUMN IF NOT EXISTS content_embedding vector(1536);
ALTER TABLE spec_documents ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS spec_documents_content_embedding_idx ON spec_documents USING ivfflat (content_embedding vector_l2_ops);
CREATE INDEX IF NOT EXISTS spec_documents_metadata_idx ON spec_documents USING GIN (metadata);
