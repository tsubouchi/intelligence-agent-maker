import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'AutoSpec Generator',
  description: 'AIがソフトウェア開発仕様書を自動生成',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={`${inter.variable} font-sans bg-background text-text`}>
        <main className="min-h-screen flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
} 