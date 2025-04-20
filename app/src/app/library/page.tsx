'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import Header from '../../components/Header';
import SearchBar from '../../components/SearchBar';

// Supabaseクライアント初期化
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type SpecDocument = {
  id: string;
  title: string;
  software_type: string;
  deploy_target: string;
  created_at: string;
};

export default function LibraryPage() {
  const [specs, setSpecs] = useState<SpecDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSpecs = async () => {
      try {
        const { data, error } = await supabase
          .from('spec_documents')
          .select('id, title, software_type, deploy_target, created_at')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setSpecs(data || []);
      } catch (error) {
        console.error('Error fetching specs:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSpecs();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('この仕様書を削除してもよろしいですか？')) return;
    
    try {
      const { error } = await supabase
        .from('spec_documents')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setSpecs(specs.filter(spec => spec.id !== id));
    } catch (error) {
      console.error('Error deleting spec:', error);
      alert('削除に失敗しました。再度お試しください。');
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">ライブラリ</h1>
          <Link 
            href="/" 
            className="btn-outline"
          >
            トップに戻る
          </Link>
        </div>
        
        <div className="mb-8 flex justify-center">
          <SearchBar />
        </div>
        
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">マイ仕様書</h2>
          <Link 
            href="/library/search" 
            className="btn-outline"
          >
            詳細検索
          </Link>
        </div>
        
        {isLoading ? (
          <div className="text-center py-10">読み込み中...</div>
        ) : specs.length === 0 ? (
          <div className="text-center py-10 border border-border">
            <p className="mb-4">仕様書がまだありません</p>
            <Link 
              href="/" 
              className="btn-primary"
            >
              最初の仕様書を生成する
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-primary text-secondary">
                  <th className="p-3 text-left">タイトル</th>
                  <th className="p-3 text-left">種別</th>
                  <th className="p-3 text-left">環境</th>
                  <th className="p-3 text-left">作成日</th>
                  <th className="p-3 text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {specs.map((spec) => (
                  <tr key={spec.id} className="border-b border-border">
                    <td className="p-3">
                      <Link 
                        href={`/spec/${spec.id}`} 
                        className="hover:underline"
                      >
                        {spec.title}
                      </Link>
                    </td>
                    <td className="p-3">{spec.software_type}</td>
                    <td className="p-3">{spec.deploy_target}</td>
                    <td className="p-3">{new Date(spec.created_at).toLocaleDateString('ja-JP')}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleDelete(spec.id)}
                        className="text-red-600 hover:underline"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
} 