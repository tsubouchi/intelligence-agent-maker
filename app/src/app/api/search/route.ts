import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 型定義
type OpenAIClient = any;

// Supabaseクライアント初期化
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// OpenAIクライアント初期化 (サーバーサイドのみ)
let openai: OpenAIClient;
async function getOpenAI() {
  if (!openai) {
    const { OpenAI } = await import('openai');
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }
  return openai;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      query, 
      softwareType, 
      deployTarget, 
      dateRange, 
      searchMode = 'hybrid', 
      techFilters = {} 
    } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    // 検索モードに応じて異なる検索戦略を実行
    switch (searchMode) {
      case 'metadata':
        return await performMetadataSearch(query, softwareType, deployTarget, dateRange, techFilters);
      case 'vector':
        return await performVectorSearch(query, softwareType, deployTarget, dateRange);
      case 'text':
        return await performTextSearch(query, softwareType, deployTarget, dateRange);
      case 'hybrid':
      default:
        return await performHybridSearch(query, softwareType, deployTarget, dateRange, techFilters);
    }
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// メタデータ検索 - 改良版
async function performMetadataSearch(
  query: string, 
  softwareType?: string, 
  deployTarget?: string, 
  dateRange?: string,
  techFilters: Record<string, string[]> = {}
) {
  try {
    // クエリ条件の構築
    let queryBuilder = supabase
      .from('spec_documents')
      .select('*');
    
    // メタデータ条件の構築
    const metadataFilters = [];
    
    // キーワード検索
    if (query) {
      // メタデータのキーワードに一致するものを検索
      metadataFilters.push(`metadata->>'keywords' ilike '%${query}%'`);
      
      // summaryフィールドも検索
      metadataFilters.push(`metadata->>'summary' ilike '%${query}%'`);
      
      // タイトルと内容も検索
      metadataFilters.push(`title ilike '%${query}%'`);
      metadataFilters.push(`content ilike '%${query}%'`);
    }
    
    // 技術スタックフィルター
    if (Object.keys(techFilters).length > 0) {
      Object.entries(techFilters).forEach(([category, technologies]) => {
        if (technologies && technologies.length > 0) {
          technologies.forEach(tech => {
            metadataFilters.push(`metadata->'techStack'->'${category}' @> '"${tech}"'`);
          });
        }
      });
    }
    
    // ソフトウェア種別フィルター
    if (softwareType) {
      metadataFilters.push(`software_type = '${softwareType}'`);
    }
    
    // デプロイ環境フィルター
    if (deployTarget) {
      metadataFilters.push(`deploy_target = '${deployTarget}'`);
    }
    
    // フィルター条件の適用
    if (metadataFilters.length > 0) {
      queryBuilder = queryBuilder.or(metadataFilters.join(','));
    }
    
    // 結果の取得
    const { data: results, error } = await queryBuilder;
    
    if (error) throw error;
    
    // 日付フィルターを適用（必要な場合）
    let filteredResults = results || [];
    if (dateRange && dateRange !== 'all') {
      const days = parseInt(dateRange);
      const date = new Date();
      date.setDate(date.getDate() - days);
      
      filteredResults = filteredResults.filter(item => {
        return new Date(item.created_at) >= date;
      });
    }
    
    // レスポンスフォーマットの調整
    return NextResponse.json({ 
      results: filteredResults.map(item => ({
        ...item,
        similarity: 1.0 // メタデータ検索ではUIとの互換性のため固定値
      }))
    });
  } catch (error) {
    console.error('Metadata search error:', error);
    throw error;
  }
}

// ベクトル検索
async function performVectorSearch(query: string, softwareType?: string, deployTarget?: string, dateRange?: string) {
  try {
    // OpenAI APIで検索クエリのembeddingを生成
    const openaiClient = await getOpenAI();
    const embeddingResponse = await openaiClient.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });
    const embedding = embeddingResponse.data[0].embedding;
    
    // Supabaseでベクトル検索を実行
    const { data: results, error } = await supabase.rpc('match_documents_filtered', {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 20,
      filter_software_type: softwareType || null,
      filter_deploy_target: deployTarget || null
    });
    
    if (error) throw error;
    
    // 日付フィルターを適用（必要な場合）
    let filteredResults = results || [];
    if (dateRange && dateRange !== 'all') {
      const days = parseInt(dateRange);
      const date = new Date();
      date.setDate(date.getDate() - days);
      
      filteredResults = filteredResults.filter(item => {
        return new Date(item.created_at) >= date;
      });
    }
    
    return NextResponse.json({ results: filteredResults });
  } catch (error) {
    console.error('Vector search error:', error);
    throw error;
  }
}

// テキスト検索
async function performTextSearch(query: string, softwareType?: string, deployTarget?: string, dateRange?: string) {
  try {
    // メタデータフィルターを構築
    const metadataFilter: Record<string, any> = {};
    
    if (softwareType) {
      metadataFilter.software_type = softwareType;
    }
    
    if (deployTarget) {
      metadataFilter.deploy_target = deployTarget;
    }
    
    // テキスト検索を実行
    const { data: results, error } = await supabase
      .from('spec_documents')
      .select('*')
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`);
    
    if (error) throw error;
    
    // フィルター適用
    let filteredResults = results || [];
    
    if (softwareType) {
      filteredResults = filteredResults.filter(item => item.software_type === softwareType);
    }
    
    if (deployTarget) {
      filteredResults = filteredResults.filter(item => item.deploy_target === deployTarget);
    }
    
    // 日付フィルター
    if (dateRange && dateRange !== 'all') {
      const days = parseInt(dateRange);
      const date = new Date();
      date.setDate(date.getDate() - days);
      
      filteredResults = filteredResults.filter(item => {
        return new Date(item.created_at) >= date;
      });
    }
    
    return NextResponse.json({ results: filteredResults });
  } catch (error) {
    console.error('Text search error:', error);
    throw error;
  }
}

// ハイブリッド検索（テキスト + ベクトル + メタデータ）
async function performHybridSearch(
  query: string, 
  softwareType?: string, 
  deployTarget?: string, 
  dateRange?: string,
  techFilters: Record<string, string[]> = {}
) {
  try {
    // OpenAI APIで検索クエリのembeddingを生成
    const openaiClient = await getOpenAI();
    const embeddingResponse = await openaiClient.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });
    const embedding = embeddingResponse.data[0].embedding;
    
    // メタデータフィルターを構築
    let metadataFilter = null;
    if (softwareType || deployTarget || Object.keys(techFilters).length > 0) {
      metadataFilter = {};
      if (softwareType) metadataFilter.software_type = softwareType;
      if (deployTarget) metadataFilter.deploy_target = deployTarget;
      
      // 技術スタックフィルターを追加
      if (Object.keys(techFilters).length > 0) {
        metadataFilter.techStack = {};
        Object.entries(techFilters).forEach(([category, technologies]) => {
          if (technologies && technologies.length > 0) {
            metadataFilter.techStack[category] = technologies;
          }
        });
      }
    }
    
    // PostgreSQLのハイブリッド検索関数を呼び出し
    const { data: results, error } = await supabase.rpc('hybrid_search', {
      search_query: query,
      metadata_filter: metadataFilter,
      software_type_filter: softwareType || null,
      deploy_target_filter: deployTarget || null,
      match_count: 20
    });
    
    if (error) {
      console.error('Hybrid search error:', error);
      
      // フォールバック: 別々の検索を実行して結果をマージ
      const [vectorResults, textResults, metadataResults] = await Promise.all([
        performVectorSearch(query, softwareType, deployTarget, dateRange),
        performTextSearch(query, softwareType, deployTarget, dateRange),
        performMetadataSearch(query, softwareType, deployTarget, dateRange, techFilters)
      ]);
      
      const vectorData = await vectorResults.json();
      const textData = await textResults.json();
      const metadataData = await metadataResults.json();
      
      // 結果をマージして重複を除去
      const allResults = [
        ...(vectorData.results || []), 
        ...(textData.results || []),
        ...(metadataData.results || [])
      ];
      const uniqueResults = Array.from(new Map(allResults.map(item => [item.id, item])).values());
      
      // 日付フィルター
      let filteredResults = uniqueResults;
      if (dateRange && dateRange !== 'all') {
        const days = parseInt(dateRange);
        const date = new Date();
        date.setDate(date.getDate() - days);
        
        filteredResults = filteredResults.filter(item => {
          return new Date(item.created_at) >= date;
        });
      }
      
      return NextResponse.json({ 
        results: filteredResults,
        note: 'Fallback search method was used'
      });
    }
    
    // 日付フィルターを適用（必要な場合）
    let filteredResults = results || [];
    if (dateRange && dateRange !== 'all') {
      const days = parseInt(dateRange);
      const date = new Date();
      date.setDate(date.getDate() - days);
      
      filteredResults = filteredResults.filter(item => {
        return new Date(item.created_at) >= date;
      });
    }
    
    return NextResponse.json({ 
      results: filteredResults.map(item => ({
        ...item,
        similarity: item.combined_score // UIとの互換性のためにsimilarityフィールドを追加
      }))
    });
  } catch (error) {
    console.error('Hybrid search error:', error);
    throw error;
  }
} 