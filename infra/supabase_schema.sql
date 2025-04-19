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

-- Users can view only their documents
create policy "Users can view own docs" on public.spec_documents
  for select using (auth.uid() = user_id);

-- Users can insert their own documents
create policy "Users can insert own docs" on public.spec_documents
  for insert with check (auth.uid() = user_id);

-- Users can update their own documents
create policy "Users can update own docs" on public.spec_documents
  for update using (auth.uid() = user_id);

-- Users can delete their own documents
create policy "Users can delete own docs" on public.spec_documents
  for delete using (auth.uid() = user_id); 