'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Header() {
  // TODO: 実際の認証状態を反映させる
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [user, setUser] = useState({ email: 'user@example.com' });

  const handleLogout = async () => {
    // TODO: 実際のログアウト処理を実装
    setIsLoggedIn(false);
  };

  return (
    <header className="bg-primary text-secondary p-4 border-b border-border">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          AutoSpec Generator
        </Link>

        <div className="hidden md:flex items-center space-x-6">
          <Link href="/library" className="hover:underline">
            ライブラリ
          </Link>
          <Link href="/archives" className="hover:underline">
            マイアーカイブ
          </Link>
        </div>

        <div className="flex items-center space-x-4">
          {isLoggedIn ? (
            <>
              <span className="hidden md:inline">{user.email}</span>
              <button 
                onClick={handleLogout}
                className="px-3 py-1 border border-secondary text-secondary"
              >
                ログアウト
              </button>
            </>
          ) : (
            <Link 
              href="/login"
              className="px-3 py-1 border border-secondary text-secondary"
            >
              ログイン
            </Link>
          )}
        </div>
      </div>
    </header>
  );
} 