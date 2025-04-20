'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import Header from '../../../components/Header';
import ReactMarkdown from 'react-markdown';

// Supabaseクライアント初期化
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type SpecDocument = {
  id: string;
  title: string;
  content: string;
  software_type: string;
  deploy_target: string;
  metadata: any;
  created_at: string;
};

type UserArchive = {
  id: string;
  spec_id: string;
  is_favorite: boolean;
  notes: string;
};

export default function SpecDetailPage() {
  const params = useParams();
  const router = useRouter();
  const specId = params.id as string;
  
  const [spec, setSpec] = useState<SpecDocument | null>(null);
  const [archive, setArchive] = useState<UserArchive | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const fetchSpec = async () => {
      try {
        setIsLoading(true);
        
        // 仕様書情報の取得
        const { data: specData, error: specError } = await supabase
          .from('spec_documents')
          .select('*')
          .eq('id', specId)
          .single();
        
        if (specError) throw specError;
        setSpec(specData);
        
        // アーカイブ情報の取得
        const { data: archiveData, error: archiveError } = await supabase
          .from('user_archives')
          .select('*')
          .eq('spec_id', specId)
          .maybeSingle();
        
        if (!archiveError && archiveData) {
          setArchive(archiveData);
          setNotes(archiveData.notes || '');
          setIsFavorite(archiveData.is_favorite);
        }
      } catch (err) {
        console.error('Error fetching spec:', err);
        setError('仕様書の取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (specId) {
      fetchSpec();
    }
  }, [specId]);

  // MDファイルとしてダウンロード
  const handleDownload = () => {
    if (!spec) return;
    
    const element = document.createElement('a');
    const file = new Blob([spec.content], {type: 'text/markdown'});
    element.href = URL.createObjectURL(file);
    element.download = spec.title.endsWith('.md') ? spec.title : `${spec.title}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // お気に入り状態の切り替え
  const toggleFavorite = async () => {
    if (!spec) return;
    
    try {
      if (archive) {
        // 既存のアーカイブがある場合は更新
        const { error } = await supabase
          .from('user_archives')
          .update({ 
            is_favorite: !isFavorite,
            notes: notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', archive.id);
          
        if (error) throw error;
      } else {
        // アーカイブがない場合は新規作成
        const { error } = await supabase
          .from('user_archives')
          .insert({
            user_id: (await supabase.auth.getUser()).data.user?.id,
            spec_id: specId,
            is_favorite: !isFavorite,
            notes: notes
          });
          
        if (error) throw error;
      }
      
      // UI状態の更新
      setIsFavorite(!isFavorite);
    } catch (err) {
      console.error('Error updating favorite status:', err);
      alert('お気に入り状態の更新に失敗しました');
    }
  };

  // メモの保存
  const saveNotes = async () => {
    if (!spec) return;
    
    try {
      if (archive) {
        // 既存のアーカイブがある場合は更新
        const { error } = await supabase
          .from('user_archives')
          .update({ 
            notes: notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', archive.id);
          
        if (error) throw error;
      } else {
        // アーカイブがない場合は新規作成
        const { error } = await supabase
          .from('user_archives')
          .insert({
            user_id: (await supabase.auth.getUser()).data.user?.id,
            spec_id: specId,
            is_favorite: isFavorite,
            notes: notes
          });
          
        if (error) throw error;
      }
      
      alert('メモを保存しました');
    } catch (err) {
      console.error('Error saving notes:', err);
      alert('メモの保存に失敗しました');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="max-w-6xl mx-auto p-6">
          <div className="text-center py-10">
            <p className="text-xl">読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !spec) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="max-w-6xl mx-auto p-6">
          <div className="text-center py-10 border border-border rounded-md">
            <p className="text-xl text-red-500">{error || '仕様書が見つかりません'}</p>
            <Link href="/library" className="mt-4 inline-block btn-primary">
              ライブラリに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{spec.title.replace('_basic_design.md', '')}</h1>
              <button 
                onClick={toggleFavorite}
                className="text-2xl"
                title={isFavorite ? 'お気に入りから削除' : 'お気に入りに追加'}
              >
                {isFavorite ? '★' : '☆'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="px-2 py-1 text-xs bg-primary text-secondary rounded-md">{spec.software_type}</span>
              <span className="px-2 py-1 text-xs bg-primary text-secondary rounded-md">{spec.deploy_target}</span>
              <span className="px-2 py-1 text-xs border border-border rounded-md">
                {new Date(spec.created_at).toLocaleDateString('ja-JP')}
              </span>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={handleDownload}
              className="btn-primary"
              title="MDファイルとしてダウンロード"
            >
              MDダウンロード
            </button>
            <Link href="/library" className="btn-outline">
              ライブラリに戻る
            </Link>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-3/4">
            <div className="p-6 border border-border rounded-md bg-white">
              <div className="prose max-w-none">
                <ReactMarkdown>{spec.content}</ReactMarkdown>
              </div>
            </div>
          </div>
          
          <div className="w-full md:w-1/4">
            <div className="sticky top-4">
              <div className="p-4 border border-border rounded-md mb-4">
                <h2 className="text-xl font-bold mb-3">メモ</h2>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 border border-border rounded-md mb-2"
                  rows={6}
                  placeholder="この仕様書に関するメモを入力..."
                />
                <button 
                  onClick={saveNotes}
                  className="btn-primary w-full"
                >
                  メモを保存
                </button>
              </div>
              
              {spec.metadata && (
                <div className="p-4 border border-border rounded-md">
                  <h2 className="text-xl font-bold mb-3">メタデータ</h2>
                  
                  {spec.metadata.summary && (
                    <div className="mb-3">
                      <h3 className="font-semibold">概要</h3>
                      <p className="text-sm text-gray-600">{spec.metadata.summary}</p>
                    </div>
                  )}
                  
                  {spec.metadata.keywords && spec.metadata.keywords.length > 0 && (
                    <div className="mb-3">
                      <h3 className="font-semibold">キーワード</h3>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {spec.metadata.keywords.map((keyword: string, index: number) => (
                          <span key={index} className="px-2 py-0.5 text-xs bg-gray-100 rounded">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {spec.metadata.techStack && (
                    <div className="mb-3">
                      <h3 className="font-semibold">技術スタック</h3>
                      <div className="grid grid-cols-1 gap-2 mt-1">
                        {Object.entries(spec.metadata.techStack).map(([category, techs]: [string, any]) => (
                          techs && techs.length > 0 ? (
                            <div key={category} className="text-sm">
                              <span className="font-medium">{category}: </span>
                              {(techs as string[]).join(', ')}
                            </div>
                          ) : null
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {spec.metadata.architecturePatterns && spec.metadata.architecturePatterns.length > 0 && (
                    <div className="mb-3">
                      <h3 className="font-semibold">アーキテクチャパターン</h3>
                      <p className="text-sm">{spec.metadata.architecturePatterns.join(', ')}</p>
                    </div>
                  )}
                  
                  {spec.metadata.designPatterns && spec.metadata.designPatterns.length > 0 && (
                    <div className="mb-3">
                      <h3 className="font-semibold">デザインパターン</h3>
                      <p className="text-sm">{spec.metadata.designPatterns.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 