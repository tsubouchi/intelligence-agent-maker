-- Enable vector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- トライグラム検索用

-- specs table
CREATE TABLE public.spec_documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  title text not null,
  content text not null,
  software_type text,
  deploy_target text,
  content_embedding vector(1536),
  metadata jsonb DEFAULT '{}'::jsonb,  -- メタデータをJSONBで保存
  created_at timestamptz default now()
);

-- ユーザーアーカイブテーブル
CREATE TABLE public.user_archives (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  spec_id uuid not null references public.spec_documents(id) on delete cascade,
  is_favorite boolean default false,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  UNIQUE(user_id, spec_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS spec_documents_content_embedding_idx ON spec_documents USING ivfflat (content_embedding vector_l2_ops);
CREATE INDEX IF NOT EXISTS spec_documents_title_trgm_idx ON spec_documents USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS spec_documents_content_trgm_idx ON spec_documents USING GIN (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS spec_documents_metadata_idx ON spec_documents USING GIN (metadata);
CREATE INDEX IF NOT EXISTS user_archives_user_id_idx ON user_archives(user_id);
CREATE INDEX IF NOT EXISTS user_archives_spec_id_idx ON user_archives(spec_id);

-- Row Level Security
ALTER TABLE public.spec_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_archives ENABLE ROW LEVEL SECURITY;

-- Admin can view all documents
CREATE POLICY "Admins can view all docs" ON public.spec_documents
  FOR SELECT USING (auth.uid() = 'admin-uuid' OR auth.email() = 't@bonginkan.ai');

-- Users can view only their documents
CREATE POLICY "Users can view own docs" ON public.spec_documents
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own documents
CREATE POLICY "Users can insert own docs" ON public.spec_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own documents
CREATE POLICY "Users can update own docs" ON public.spec_documents
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own documents
CREATE POLICY "Users can delete own docs" ON public.spec_documents
  FOR DELETE USING (auth.uid() = user_id);

-- Admin can view all archives
CREATE POLICY "Admins can view all archives" ON public.user_archives
  FOR SELECT USING (auth.uid() = 'admin-uuid' OR auth.email() = 't@bonginkan.ai');

-- Users can view only their archives
CREATE POLICY "Users can view own archives" ON public.user_archives
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own archives
CREATE POLICY "Users can insert own archives" ON public.user_archives
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own archives
CREATE POLICY "Users can update own archives" ON public.user_archives
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own archives
CREATE POLICY "Users can delete own archives" ON public.user_archives
  FOR DELETE USING (auth.uid() = user_id);

-- Function for basic semantic search
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  software_type text,
  deploy_target text,
  metadata jsonb,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sd.id,
    sd.title,
    sd.content,
    sd.software_type,
    sd.deploy_target,
    sd.metadata,
    sd.created_at,
    1 - (sd.content_embedding <=> query_embedding) as similarity
  FROM
    spec_documents sd
  WHERE
    1 - (sd.content_embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT
    match_count;
END;
$$;

-- Function for semantic search with filters
CREATE OR REPLACE FUNCTION match_documents_filtered(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_software_type text DEFAULT NULL,
  filter_deploy_target text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  software_type text,
  deploy_target text,
  metadata jsonb,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sd.id,
    sd.title,
    sd.content,
    sd.software_type,
    sd.deploy_target,
    sd.metadata,
    sd.created_at,
    1 - (sd.content_embedding <=> query_embedding) as similarity
  FROM
    spec_documents sd
  WHERE
    1 - (sd.content_embedding <=> query_embedding) > match_threshold
    AND (filter_software_type IS NULL OR sd.software_type = filter_software_type)
    AND (filter_deploy_target IS NULL OR sd.deploy_target = filter_deploy_target)
  ORDER BY
    similarity DESC
  LIMIT
    match_count;
END;
$$;

-- ハイブリッド検索関数（テキストとベクトル検索の組み合わせ）
CREATE OR REPLACE FUNCTION hybrid_search(
  search_query text,
  metadata_filter jsonb DEFAULT NULL,
  software_type_filter text DEFAULT NULL,
  deploy_target_filter text DEFAULT NULL,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  software_type text,
  deploy_target text,
  metadata jsonb,
  created_at timestamptz,
  text_similarity float,
  vector_similarity float,
  combined_score float
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_embedding vector(1536);
BEGIN
  -- このパラメータはMCP経由で外部から埋め込みベクトルを渡す場合に使用
  -- 実際の使用時にはAPI側で埋め込みを生成してパラメータとして渡す
  query_embedding := NULL;

  -- テキスト検索とベクトル検索を組み合わせたハイブリッド検索
  RETURN QUERY
  SELECT
    sd.id,
    sd.title,
    sd.content,
    sd.software_type,
    sd.deploy_target,
    sd.metadata,
    sd.created_at,
    -- テキスト類似度スコア（0-1の範囲）
    GREATEST(
      COALESCE(similarity(sd.title, search_query), 0),
      COALESCE(similarity(sd.content, search_query), 0)
    ) as text_similarity,
    -- ベクトル類似度スコア（埋め込みがあれば計算、なければ0）
    CASE 
      WHEN query_embedding IS NOT NULL THEN 1 - (sd.content_embedding <=> query_embedding)
      ELSE 0
    END as vector_similarity,
    -- 組み合わせスコア（テキスト検索に重み70%、ベクトル検索に30%）
    GREATEST(
      COALESCE(similarity(sd.title, search_query), 0),
      COALESCE(similarity(sd.content, search_query), 0)
    ) * 0.7 +
    CASE 
      WHEN query_embedding IS NOT NULL THEN (1 - (sd.content_embedding <=> query_embedding)) * 0.3
      ELSE 0
    END as combined_score
  FROM
    spec_documents sd
  WHERE
    -- テキスト検索条件
    (
      sd.title ILIKE '%' || search_query || '%' OR
      sd.content ILIKE '%' || search_query || '%' OR
      similarity(sd.title, search_query) > 0.1 OR
      similarity(sd.content, search_query) > 0.1
    )
    -- メタデータフィルター
    AND (metadata_filter IS NULL OR sd.metadata @> metadata_filter)
    -- その他のフィルター
    AND (software_type_filter IS NULL OR sd.software_type = software_type_filter)
    AND (deploy_target_filter IS NULL OR sd.deploy_target = deploy_target_filter)
  ORDER BY
    combined_score DESC
  LIMIT
    match_count;
END;
$$;

-- メタデータ検索関数
CREATE OR REPLACE FUNCTION search_by_metadata(
  metadata_query jsonb,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  software_type text,
  deploy_target text,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sd.id,
    sd.title,
    sd.content,
    sd.software_type,
    sd.deploy_target,
    sd.metadata,
    sd.created_at
  FROM
    spec_documents sd
  WHERE
    sd.metadata @> metadata_query
  ORDER BY
    sd.created_at DESC
  LIMIT
    match_count;
END;
$$;

-- ユーザーアーカイブ検索関数
CREATE OR REPLACE FUNCTION get_user_archived_specs(
  user_uuid uuid
)
RETURNS TABLE (
  id uuid,
  spec_id uuid,
  title text,
  content text,
  software_type text,
  deploy_target text,
  metadata jsonb,
  is_favorite boolean,
  notes text,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ua.id,
    sd.id as spec_id,
    sd.title,
    sd.content,
    sd.software_type,
    sd.deploy_target,
    sd.metadata,
    ua.is_favorite,
    ua.notes,
    ua.created_at
  FROM
    user_archives ua
    JOIN spec_documents sd ON ua.spec_id = sd.id
  WHERE
    ua.user_id = user_uuid
  ORDER BY
    ua.is_favorite DESC,
    ua.created_at DESC;
END;
$$; 