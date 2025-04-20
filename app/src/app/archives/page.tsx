'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import Header from '../../components/Header';

// Supabaseクライアント初期化
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type ArchivedSpec = {
  id: string;
  spec_id: string;
  title: string;
  software_type: string;
  deploy_target: string;
  metadata: any;
  is_favorite: boolean;
  notes: string;
  created_at: string;
};

export default function ArchivesPage() {
  const [archives, setArchives] = useState<ArchivedSpec[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'favorites'

  useEffect(() => {
    const fetchArchives = async () => {
      try {
        setIsLoading(true);
        
        // ユーザーIDの取得
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) throw new Error('未ログイン状態です');
        
        // アーカイブの取得
        const { data, error } = await supabase.rpc('get_user_archived_specs', {
          user_uuid: user.id
        });
        
        if (error) throw error;
        setArchives(data || []);
      } catch (err) {
        console.error('Error fetching archives:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchArchives();
  }, []);

  // フィルター適用
  const filteredArchives = filter === 'all' 
    ? archives 
    : archives.filter(archive => archive.is_favorite);

  return (
    <div className="min-h-screen">
      <Header />
      
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">マイアーカイブ</h1>
          <div className="flex gap-4">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-md ${filter === 'all' ? 'bg-primary text-secondary' : 'bg-gray-100'}`}
            >
              すべて
            </button>
            <button
              onClick={() => setFilter('favorites')}
              className={`px-4 py-2 rounded-md ${filter === 'favorites' ? 'bg-primary text-secondary' : 'bg-gray-100'}`}
            >
              お気に入り
            </button>
            <Link 
              href="/library" 
              className="btn-outline"
            >
              ライブラリに戻る
            </Link>
          </div>
        </div>
        
        {isLoading ? (
          <div className="text-center py-10">
            <p className="text-xl">読み込み中...</p>
          </div>
        ) : filteredArchives.length === 0 ? (
          <div className="text-center py-10 border border-border rounded-md">
            <p className="mb-4">アーカイブされた仕様書がありません</p>
            <Link 
              href="/library" 
              className="btn-primary"
            >
              ライブラリを見る
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArchives.map((archive) => (
              <div 
                key={archive.id} 
                className="border border-border rounded-md p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <Link 
                    href={`/spec/${archive.spec_id}`} 
                    className="text-xl font-bold hover:underline flex-grow mr-2"
                  >
                    {archive.title.replace('_basic_design.md', '')}
                  </Link>
                  <span className="text-xl">{archive.is_favorite ? '★' : '☆'}</span>
                </div>
                
                <div className="flex flex-wrap gap-2 my-2">
                  <span className="px-2 py-1 text-xs bg-primary text-secondary rounded-md">{archive.software_type}</span>
                  <span className="px-2 py-1 text-xs bg-primary text-secondary rounded-md">{archive.deploy_target}</span>
                  <span className="px-2 py-1 text-xs border border-border rounded-md">
                    {new Date(archive.created_at).toLocaleDateString('ja-JP')}
                  </span>
                </div>
                
                {archive.metadata?.keywords && archive.metadata.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 my-2">
                    {archive.metadata.keywords.slice(0, 5).map((keyword: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 text-xs bg-gray-100 rounded">
                        {keyword}
                      </span>
                    ))}
                    {archive.metadata.keywords.length > 5 && (
                      <span className="px-1.5 py-0.5 text-xs bg-gray-100 rounded">+{archive.metadata.keywords.length - 5}</span>
                    )}
                  </div>
                )}
                
                {archive.notes && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      {archive.notes.length > 100 
                        ? archive.notes.substring(0, 100) + '...' 
                        : archive.notes}
                    </p>
                  </div>
                )}
                
                <div className="mt-3 text-right">
                  <Link 
                    href={`/spec/${archive.spec_id}`} 
                    className="text-primary text-sm hover:underline"
                  >
                    詳細を見る →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 