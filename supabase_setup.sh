#!/bin/bash
set -e

# Update and install dependencies
sudo apt-get update
sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common gnupg

# Install Docker for Debian
# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Set up the repository
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update packages and install Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add current user to docker group (bongin is the username)
sudo usermod -aG docker bongin

# Clone Supabase
git clone https://github.com/supabase/supabase
cd supabase/docker

# Create .env file
cat > .env << 'EOF'
POSTGRES_PASSWORD=postgres
JWT_SECRET=$(openssl rand -base64 32)
ANON_KEY=$(openssl rand -base64 32)
SERVICE_ROLE_KEY=$(openssl rand -base64 32)
EOF

# Start Supabase
docker-compose up -d

# Apply schema
sleep 30 # Wait for PostgreSQL to be ready
cat > schema.sql << 'EOF'
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
EOF

# Apply schema
cat schema.sql | docker-compose exec -T db psql -U postgres -d postgres

echo "Supabase setup complete! Your Supabase instance is running."
echo "Admin URL: http://$(curl -s ipinfo.io/ip):3000"
echo "API URL: http://$(curl -s ipinfo.io/ip):8000"
echo "DB URL: postgresql://postgres:postgres@$(curl -s ipinfo.io/ip):5432/postgres"
