'use client';

import { useState } from 'react';
import Link from 'next/link';
import Header from '../components/Header';

const softwareTypes = ['webアプリ', 'AIエージェント'];
const deployTargets = ['GCP', 'AWS', 'Azure', 'Vercel'];

export default function Home() {
  const [idea, setIdea] = useState('');
  const [softwareType, setSoftwareType] = useState(softwareTypes[0]);
  const [deployTarget, setDeployTarget] = useState(deployTargets[0]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idea.trim()) return;

    setIsGenerating(true);

    try {
      // TODO: 実際の送信処理を実装
      // Pub/Subトピックに発行する処理を行う
      console.log({
        idea,
        softwareType,
        deployTarget,
      });

      // 仮の成功処理
      alert('仕様書生成リクエストを送信しました。マイページで確認できます。');
      setIdea('');
    } catch (error) {
      console.error('Error generating spec:', error);
      alert('エラーが発生しました。再度お試しください。');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">AI開発仕様書ジェネレーター</h1>
          <p className="text-lg">
            アイデアを入力するだけで、AIがエンジニアリングチームが開発に着手できる
            仕様書を自動生成します。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card mb-8">
          <div className="mb-4">
            <label className="block mb-2 font-bold">ソフトウェア範囲</label>
            <select 
              className="input-field"
              value={softwareType}
              onChange={(e) => setSoftwareType(e.target.value)}
            >
              {softwareTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block mb-2 font-bold">Deploy環境</label>
            <select 
              className="input-field"
              value={deployTarget}
              onChange={(e) => setDeployTarget(e.target.value)}
            >
              {deployTargets.map(target => (
                <option key={target} value={target}>{target}</option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className="block mb-2 font-bold">アイデア/要望</label>
            <textarea 
              className="input-field min-h-[200px]"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="開発したいソフトウェアのアイデアや要望を自然言語で入力してください..."
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn-primary"
            disabled={isGenerating || !idea.trim()}
          >
            {isGenerating ? '生成中...' : '仕様書を生成 🚀'}
          </button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/my-specs" className="card text-center hover:border-primary">
            <h2 className="text-xl font-bold">マイ仕様書</h2>
            <p>生成した仕様書一覧</p>
          </Link>
          
          <Link href="/library" className="card text-center hover:border-primary">
            <h2 className="text-xl font-bold">ライブラリ</h2>
            <p>仕様書を検索</p>
          </Link>
          
          <Link href="/settings" className="card text-center hover:border-primary">
            <h2 className="text-xl font-bold">設定</h2>
            <p>アカウント設定</p>
          </Link>
        </div>
      </div>
    </div>
  );
} 