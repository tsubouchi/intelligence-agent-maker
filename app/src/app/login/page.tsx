'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      // TODO: Firebase Googleログイン実装
      console.log('Google login');
      router.push('/');
    } catch (error) {
      console.error('Login error:', error);
      alert('ログインに失敗しました。再度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    setIsLoading(true);
    try {
      // TODO: Firebase Githubログイン実装
      console.log('GitHub login');
      router.push('/');
    } catch (error) {
      console.error('Login error:', error);
      alert('ログインに失敗しました。再度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 border border-border">
        <h1 className="text-3xl font-bold text-center mb-8">AutoSpec Generator</h1>
        
        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full py-3 px-4 flex items-center justify-center border border-border hover:bg-primary hover:text-secondary"
          >
            Googleでログイン
          </button>
          
          <button
            onClick={handleGithubLogin}
            disabled={isLoading}
            className="w-full py-3 px-4 flex items-center justify-center border border-border hover:bg-primary hover:text-secondary"
          >
            GitHubでログイン
          </button>
        </div>
        
        <p className="mt-8 text-center text-sm">
          ログインすることで、
          <Link href="/terms" className="underline">
            利用規約
          </Link>
          と
          <Link href="/privacy" className="underline">
            プライバシーポリシー
          </Link>
          に同意したことになります。
        </p>
      </div>
    </div>
  );
} 