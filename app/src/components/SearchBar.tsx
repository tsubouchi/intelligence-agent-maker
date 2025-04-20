'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import type { OpenAI } from 'openai';

// Supabaseクライアント初期化
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 型のみインポートして実行時には動的にインポート
// OpenAIクライアント（フロントエンドでは使わない方が良いですが、デモとして実装）
let openai: OpenAI;
if (typeof window !== 'undefined') {
  import('openai').then(OpenAIModule => {
    openai = new OpenAIModule.OpenAI({
      apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY, // 実際はサーバーサイドで処理するべき
      dangerouslyAllowBrowser: true // 本番では使わないでください
    });
  });
}

type SearchResult = {
  id: string;
  title: string;
  similarity: number;
  software_type?: string;
  deploy_target?: string;
  metadata?: any;
};

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const router = useRouter();

  // 検索実行（デバウンス処理付き）
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (query.trim().length > 2) {
        setIsSearching(true);
        try {
          // サーバーサイドAPIを使用した検索（本来はこちらが望ましい）
          const response = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query,
              searchMode: 'hybrid', // デフォルトでハイブリッド検索を使用
              matchCount: 5 // ドロップダウンには少数の結果のみ表示
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            setResults(data.results || []);
          } else {
            throw new Error('Search API failed');
          }
        } catch (error) {
          console.error('Search error:', error);
          // フォールバック: クライアントサイドで簡易検索を実行
          const fallbackResults = await performFallbackSearch(query);
          setResults(fallbackResults);
        } finally {
          setIsSearching(false);
        }
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(searchTimeout);
  }, [query]);

  // フォールバック: クライアントサイドでの簡易ベクトル検索
  const performFallbackSearch = async (searchQuery: string): Promise<SearchResult[]> => {
    try {
      // OpenAI APIで検索クエリのembeddingを作成
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: searchQuery,
      });
      const embedding = response.data[0].embedding;
      
      // Supabaseでベクトル検索を実行
      const { data, error } = await supabase.rpc('match_documents', {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 5
      });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Vector search error:', err);
      // 最終フォールバック：テキスト検索
      const { data } = await supabase
        .from('spec_documents')
        .select('id, title')
        .or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`)
        .limit(5);
      
      return data?.map(item => ({
        id: item.id,
        title: item.title,
        similarity: 0 // テキスト検索では類似度なし
      })) || [];
    }
  };

  // 検索結果アイテムをクリック
  const handleResultClick = (id: string) => {
    router.push(`/spec/${id}`);
  };

  // 詳細検索ページへ移動
  const handleAdvancedSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/library/search?q=${encodeURIComponent(query)}`);
  };

  // メタデータのキーワードを表示
  const renderKeywords = (result: SearchResult) => {
    if (!result.metadata?.keywords) return null;
    
    const keywords = Array.isArray(result.metadata.keywords)
      ? result.metadata.keywords
      : typeof result.metadata.keywords === 'string'
        ? [result.metadata.keywords]
        : [];
        
    if (keywords.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {keywords.slice(0, 3).map((keyword: string, index: number) => (
          <span key={index} className="px-1 py-0.5 text-xs bg-gray-200 rounded">
            {keyword}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="relative w-full max-w-xl">
      <form onSubmit={handleAdvancedSearch} className="w-full">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="仕様書を自然言語で検索..."
            className="w-full p-3 pr-10 border border-border bg-secondary rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button 
            type="submit"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2"
          >
            🔍
          </button>
        </div>
      </form>

      {/* 検索結果ドロップダウン */}
      {query.trim().length > 2 && (
        <div className="absolute w-full mt-1 bg-secondary border border-border rounded-md shadow-lg z-10">
          {isSearching ? (
            <div className="p-4 text-center">検索中...</div>
          ) : results.length > 0 ? (
            <ul>
              {results.map((result) => (
                <li 
                  key={result.id}
                  onClick={() => handleResultClick(result.id)}
                  className="p-3 hover:bg-gray-100 cursor-pointer border-b border-border last:border-b-0"
                >
                  <div className="font-medium">{result.title}</div>
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                      関連度: {Math.round(result.similarity * 100)}%
                    </div>
                    {result.software_type && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-primary text-secondary rounded">
                        {result.software_type}
                      </span>
                    )}
                  </div>
                  {/* メタデータキーワードがあれば表示 */}
                  {renderKeywords(result)}
                </li>
              ))}
              <li className="p-2 text-center border-t border-border">
                <button 
                  onClick={handleAdvancedSearch}
                  className="text-sm text-primary hover:underline"
                >
                  詳細検索へ
                </button>
              </li>
            </ul>
          ) : (
            <div className="p-4 text-center">検索結果がありません</div>
          )}
        </div>
      )}
    </div>
  );
} 