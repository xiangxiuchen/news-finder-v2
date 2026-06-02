'use client';

import { useState } from 'react';
import type { NewsArticle, AISummary } from '@/types';
import { isEnglish } from '@/lib/translate';
import AISummaryPanel from './AISummary';

interface NewsCardProps {
  article: NewsArticle;
  isSaved: boolean;
  onSave: (article: NewsArticle) => void;
  onRemove: (url: string) => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

export default function NewsCard({ article, isSaved, onSave, onRemove }: NewsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [translated, setTranslated] = useState<{ title: string; description: string } | null>(null);
  const [translating, setTranslating] = useState(false);

  const showTranslate = isEnglish(article.title) || isEnglish(article.description || '');

  const handleAISummary = async () => {
    if (aiSummary) {
      setExpanded(!expanded);
      return;
    }

    setAiLoading(true);
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: article.title,
          content: article.content || article.description || '',
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAiSummary(data);
      setExpanded(true);
    } catch {
      // silently fail
    } finally {
      setAiLoading(false);
    }
  };

  const handleTranslate = async () => {
    if (translated) return;
    setTranslating(true);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: article.title,
          description: article.description || '',
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTranslated(data);
    } catch {
      // silently fail
    } finally {
      setTranslating(false);
    }
  };

  const displayTitle = translated?.title || article.title;
  const displayDescription = translated?.description || article.description;

  return (
    <div className="group">
      <div className="px-4 py-4 active:bg-gray-50 transition-colors">
        <div className="flex gap-3">
          {/* Image */}
          {article.urlToImage && (
            <div className="shrink-0">
              <img
                src={article.urlToImage}
                alt=""
                className="w-20 h-20 object-cover rounded-lg bg-gray-100"
                loading="lazy"
              />
            </div>
          )}

          {/* Content */}
          <div className="min-w-0 flex-1">
            {/* Title */}
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <h3 className="text-sm font-medium leading-snug text-gray-900 line-clamp-2 hover:text-gray-600 transition-colors">
                {displayTitle}
                {translated && !article.description && (
                  <span className="ml-1 text-[10px] text-green-500 font-normal">[译]</span>
                )}
              </h3>
            </a>

            {/* Description */}
            {displayDescription && (
              <p className="mt-1 text-xs text-gray-500 line-clamp-2 leading-relaxed">
                {displayDescription}
                {translated && (
                  <span className="ml-1 text-[10px] text-green-500">[译]</span>
                )}
              </p>
            )}

            {/* Meta & Actions */}
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[11px] text-gray-400 min-w-0">
                <span className="truncate max-w-[100px]">{article.source.name}</span>
                <span>·</span>
                <span className="shrink-0">{timeAgo(article.publishedAt)}</span>
                {translated && (
                  <>
                    <span>·</span>
                    <span className="text-green-500">已翻译</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {/* Translate button */}
                {showTranslate && !translated && (
                  <button
                    onClick={handleTranslate}
                    disabled={translating}
                    className="px-2 py-1 text-[11px] font-medium text-green-600 bg-green-50
                               rounded-md hover:bg-green-100 transition-colors disabled:opacity-50"
                  >
                    {translating ? '翻译中' : '译中文'}
                  </button>
                )}

                {/* AI Summary */}
                <button
                  onClick={handleAISummary}
                  disabled={aiLoading}
                  className="px-2 py-1 text-[11px] font-medium text-purple-600 bg-purple-50
                             rounded-md hover:bg-purple-100 transition-colors disabled:opacity-50"
                >
                  {aiLoading ? (
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                      分析中
                    </span>
                  ) : (
                    'AI 选题'
                  )}
                </button>

                {/* Save / Remove */}
                <button
                  onClick={() => (isSaved ? onRemove(article.url) : onSave(article))}
                  className={`p-1.5 rounded-md transition-colors ${
                    isSaved
                      ? 'text-amber-500 hover:bg-amber-50'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <svg className="w-4 h-4" fill={isSaved ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* AI Summary Panel */}
        {expanded && aiSummary && (
          <AISummaryPanel summary={aiSummary} onClose={() => setExpanded(false)} />
        )}
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-gray-50" />
    </div>
  );
}
