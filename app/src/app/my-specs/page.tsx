'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';

type Specification = {
  id: string;
  title: string;
  created_at: string;
  software_type: string;
  deploy_target: string;
};

export default function MySpecsPage() {
  const [specs, setSpecs] = useState<Specification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // TODO: 実際のSupabase取得処理
    // ダミーデータを表示
    const dummySpecs: Specification[] = [
      {
        id: '1',
        title: 'ECサイト_basic_design.md',
        created_at: '2023-04-20T12:00:00Z',
        software_type: 'webアプリ',
        deploy_target: 'GCP',
      },
      {
        id: '2',
        title: 'ChatBot_basic_design.md',
        created_at: '2023-04-19T15:30:00Z',
        software_type: 'AIエージェント',
        deploy_target: 'AWS',
      },
    ];
    
    setSpecs(dummySpecs);
    setIsLoading(false);
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('この仕様書を削除してもよろしいですか？')) return;
    
    try {
      // TODO: 実際の削除処理
      setSpecs(specs.filter(spec => spec.id !== id));
    } catch (error) {
      console.error('Delete error:', error);
      alert('削除に失敗しました。再度お試しください。');
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">マイ仕様書</h1>
          <Link 
            href="/" 
            className="btn-outline"
          >
            新規作成
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