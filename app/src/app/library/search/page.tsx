'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import Header from '../../../components/Header';

// Supabaseクライアント初期化
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type SearchResult = {
  id: string;
  title: string;
  content: string;
  software_type: string;
  deploy_target: string;
  metadata?: any;
  created_at: string;
  similarity?: number;
  text_similarity?: number;
  vector_similarity?: number;
  combined_score?: number;
};

type SearchMode = 'hybrid' | 'vector' | 'text' | 'metadata';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [softwareType, setSoftwareType] = useState('all');
  const [deployTarget, setDeployTarget] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [searchMode, setSearchMode] = useState<SearchMode>('hybrid');

  // 検索実行
  useEffect(() => {
    const performSearch = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            softwareType: softwareType !== 'all' ? softwareType : undefined,
            deployTarget: deployTarget !== 'all' ? deployTarget : undefined,
            dateRange,
            searchMode
          })
        });

        if (!response.ok) throw new Error('Search API error');
        const data = await response.json();
        setResults(data.results);
      } catch (error) {
        console.error('Search failed:', error);
        // フォールバック処理は省略
      } finally {
        setIsLoading(false);
      }
    };

    if (query.trim()) {
      performSearch();
    }
  }, [query, softwareType, deployTarget, dateRange, searchMode]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // 既に状態は更新されているので、追加のアクションは不要
  };

  // コンテンツの抜粋を生成（検索クエリに関連する部分を強調）
  const generateExcerpt = (content: string, maxLength = 200) => {
    if (!content) return '';
    
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    let startIndex = lowerContent.indexOf(lowerQuery);
    if (startIndex === -1) startIndex = 0;
    
    // コンテキストを含むために前後に余白を追加
    startIndex = Math.max(0, startIndex - 50);
    const excerpt = content.slice(startIndex, startIndex + maxLength);
    
    return startIndex > 0 ? `...${excerpt}...` : `${excerpt}...`;
  };

  // メタデータの表示形式を整える
  const formatMetadata = (metadata: any) => {
    if (!metadata) return null;
    
    const keywordsArray = Array.isArray(metadata.keywords) 
      ? metadata.keywords 
      : typeof metadata.keywords === 'string' 
        ? [metadata.keywords] 
        : [];
    
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {keywordsArray.map((keyword: string, index: number) => (
          <span key={index} className="px-1 py-0.5 text-xs bg-gray-200 rounded">
            {keyword}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <Header />
      
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">仕様書検索</h1>
          <Link href="/library" className="btn-outline">
            ライブラリに戻る
          </Link>
        </div>
        
        <div className="mb-8">
          <form onSubmit={handleSearch} className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="自然言語で仕様書を検索..."
                className="flex-grow p-3 border border-border bg-secondary rounded-md"
              />
              
              <select 
                value={searchMode}
                onChange={(e) => setSearchMode(e.target.value as SearchMode)}
                className="p-3 border border-border bg-secondary rounded-md"
              >
                <option value="hybrid">ハイブリッド検索</option>
                <option value="vector">ベクトル検索</option>
                <option value="text">テキスト検索</option>
                <option value="metadata">メタデータ検索</option>
              </select>
              
              <button type="submit" className="btn-primary whitespace-nowrap">
                検索
              </button>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4">
              <select 
                value={softwareType}
                onChange={(e) => setSoftwareType(e.target.value)}
                className="p-3 border border-border bg-secondary rounded-md"
              >
                <option value="all">全種別</option>
                <option value="webアプリ">Webアプリ</option>
                <option value="AIエージェント">AIエージェント</option>
              </select>
              
              <select 
                value={deployTarget}
                onChange={(e) => setDeployTarget(e.target.value)}
                className="p-3 border border-border bg-secondary rounded-md"
              >
                <option value="all">全環境</option>
                <option value="GCP">GCP</option>
                <option value="AWS">AWS</option>
                <option value="Azure">Azure</option>
                <option value="Vercel">Vercel</option>
              </select>
              
              <select 
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="p-3 border border-border bg-secondary rounded-md"
              >
                <option value="all">全期間</option>
                <option value="7">1週間以内</option>
                <option value="30">1ヶ月以内</option>
                <option value="90">3ヶ月以内</option>
              </select>
            </div>
          </form>
        </div>
        
        {isLoading ? (
          <div className="text-center py-10">
            <p className="text-xl">検索中...</p>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">{results.length}件の検索結果</p>
              <p className="text-sm text-gray-500">検索モード: {
                searchMode === 'hybrid' ? 'ハイブリッド' :
                searchMode === 'vector' ? 'ベクトル' :
                searchMode === 'text' ? 'テキスト' : 'メタデータ'
              }</p>
            </div>
            
            {results.map((result) => (
              <div key={result.id} className="border border-border p-4 rounded-md">
                <Link href={`/spec/${result.id}`} className="block">
                  <h2 className="text-xl font-bold hover:underline">{result.title}</h2>
                  
                  <div className="flex flex-wrap gap-2 my-2">
                    <span className="px-2 py-1 text-xs bg-primary text-secondary rounded-md">{result.software_type}</span>
                    <span className="px-2 py-1 text-xs bg-primary text-secondary rounded-md">{result.deploy_target}</span>
                    <span className="px-2 py-1 text-xs border border-border rounded-md">
                      {new Date(result.created_at).toLocaleDateString('ja-JP')}
                    </span>
                    {result.similarity && (
                      <span className="px-2 py-1 text-xs border border-border rounded-md">
                        関連度: {Math.round(result.similarity * 100)}%
                      </span>
                    )}
                  </div>
                  
                  {/* メタデータの表示 */}
                  {result.metadata && formatMetadata(result.metadata)}
                  
                  <p className="mt-2 text-gray-600">{generateExcerpt(result.content)}</p>
                  
                  {/* ハイブリッド検索の詳細スコア（デバッグ用） */}
                  {searchMode === 'hybrid' && result.text_similarity && result.vector_similarity && (
                    <div className="mt-1 text-xs text-gray-400">
                      テキスト: {Math.round(result.text_similarity * 100)}% / 
                      ベクトル: {Math.round(result.vector_similarity * 100)}%
                    </div>
                  )}
                </Link>
              </div>
            ))}
          </div>
        ) : query ? (
          <div className="text-center py-10 border border-border rounded-md">
            <p className="text-xl mb-2">検索結果がありません</p>
            <p className="text-gray-500">別のキーワードや条件で試してみてください</p>
          </div>
        ) : (
          <div className="text-center py-10 border border-border rounded-md">
            <p className="text-xl">キーワードを入力して検索してください</p>
          </div>
        )}
      </div>
    </div>
  );
} 