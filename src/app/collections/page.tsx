'use client';

import { useEffect, useState, useCallback } from 'react';
import type { NewsArticle, CollectionItem } from '@/types';
import NavBar from '@/components/NavBar';
import NewsCard from '@/components/NewsCard';
import { useCollections } from '@/hooks/useCollections';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';
import { useToast } from '@/components/Toast';

export default function CollectionsPage() {
  const { items, loaded, isSaved, save, remove, setItems } = useCollections();
  const { toast } = useToast();
  const drive = useGoogleDrive();
  const [driveInited, setDriveInited] = useState(false);

  // Load Google Identity Services script
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;
    if (window.google?.accounts) {
      setDriveInited(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => setDriveInited(true);
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  const handleSave = useCallback((article: NewsArticle) => {
    save(article);
    toast('已收藏到选题库', 'success');
  }, [save, toast]);

  const handleRemove = useCallback((id: string) => {
    remove(id);
    toast('已从选题库移除', 'info');
  }, [remove, toast]);

  const handleSyncToDrive = async () => {
    if (!drive.accessToken) {
      drive.signIn();
      return;
    }
    await drive.upload(items);
    if (drive.status === 'success') {
      toast('已同步到 Google Drive', 'success');
    }
  };

  const handleSyncFromDrive = async () => {
    if (!drive.accessToken) {
      drive.signIn();
      return;
    }
    const data = await drive.download();
    if (data && data.length > 0) {
      setItems(data);
      toast('已从 Google Drive 恢复', 'success');
    } else if (data === null) {
      toast('Google Drive 中没有找到同步数据', 'info');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <NavBar />

      <main className="max-w-2xl mx-auto pb-8">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold text-gray-900">我的选题库</h1>
              {loaded && (
                <p className="text-xs text-gray-400 mt-0.5">共 {items.length} 条收藏</p>
              )}
            </div>

            {/* Google Drive Sync */}
            {driveInited && (
              <div className="flex items-center gap-1">
                {drive.signedIn ? (
                  <>
                    <span className="flex items-center gap-1 text-[10px] text-gray-400 mr-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        drive.status === 'syncing' ? 'bg-blue-400 animate-pulse' :
                        drive.status === 'success' ? 'bg-green-400' :
                        drive.status === 'error' ? 'bg-red-400' : 'bg-green-400'
                      }`} />
                      {drive.status === 'syncing' ? '同步中' :
                       drive.status === 'success' ? '已同步' : '已连接'}
                    </span>
                    <button
                      onClick={handleSyncToDrive}
                      disabled={drive.status === 'syncing'}
                      className="px-2 py-1 text-[11px] font-medium text-blue-600 bg-blue-50
                                 rounded-md hover:bg-blue-100 transition-colors disabled:opacity-50"
                    >
                      {drive.status === 'syncing' ? '同步中...' : '上传'}
                    </button>
                    <button
                      onClick={handleSyncFromDrive}
                      disabled={drive.status === 'syncing'}
                      className="px-2 py-1 text-[11px] font-medium text-gray-600 bg-gray-50
                                 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      下载
                    </button>
                    <button
                      onClick={drive.signOut}
                      className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      title="断开连接"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={drive.signIn}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium
                               text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    同步到 Drive
                  </button>
                )}
              </div>
            )}
          </div>

          {drive.error && (
            <p className="mt-2 text-[11px] text-red-500">{drive.error}</p>
          )}
          {!driveInited && (
            <p className="mt-2 text-[11px] text-gray-400">
              配置 NEXT_PUBLIC_GOOGLE_CLIENT_ID 以启用 Google Drive 同步
            </p>
          )}
        </div>

        {/* Not loaded yet */}
        {!loaded && (
          <div className="px-4 py-20 text-center">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto" />
          </div>
        )}

        {/* Empty state */}
        {loaded && items.length === 0 && (
          <div className="px-4 py-20 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-50 mb-4">
              <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <h2 className="text-base font-medium text-gray-900 mb-1">选题库还是空的</h2>
            <p className="text-xs text-gray-400">在搜索结果中点击书签图标即可收藏新闻</p>
          </div>
        )}

        {/* Collection items */}
        {loaded && items.length > 0 && (
          <div className="animate-in">
            {items.map((item) => (
              <NewsCard
                key={item.id}
                article={item.article}
                isSaved={isSaved(item.article.url)}
                onSave={handleSave}
                onRemove={() => handleRemove(item.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
