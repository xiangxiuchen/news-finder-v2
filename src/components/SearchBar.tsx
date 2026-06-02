'use client';

import { useState, useRef, useEffect } from 'react';

interface SearchBarProps {
  onSearch: (query: string, mode: 'basic' | 'semantic') => void;
  loading?: boolean;
}

export default function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'basic' | 'semantic'>('basic');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cmd+K / Ctrl+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim(), mode);
    }
  };

  return (
    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-100">
      <div className="px-4 pt-3 pb-3 max-w-2xl mx-auto">
        {/* Mode Toggle */}
        <div className="flex items-center gap-1 mb-2.5">
          <button
            onClick={() => setMode('basic')}
            className={`px-3 py-1 text-xs rounded-full transition-all ${
              mode === 'basic'
                ? 'bg-gray-900 text-white font-medium'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            关键词搜索
          </button>
          <button
            onClick={() => setMode('semantic')}
            className={`px-3 py-1 text-xs rounded-full transition-all ${
              mode === 'semantic'
                ? 'bg-gray-900 text-white font-medium'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            AI 智能搜索
          </button>
          {mode === 'semantic' && (
            <span className="text-[10px] text-amber-600 ml-1">用大白话提问</span>
          )}
        </div>

        {/* Search Input */}
        <form onSubmit={handleSubmit} className="relative">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === 'basic' ? '搜索新闻关键词...' : '用自然语言描述你想找的新闻...'}
            className="w-full h-11 pl-4 pr-20 text-sm bg-gray-50 border border-gray-200 rounded-xl
                       focus:outline-none focus:ring-2 focus:ring-gray-300 focus:bg-white
                       transition-all placeholder:text-gray-400"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 px-3.5 text-xs font-medium
                       bg-gray-900 text-white rounded-lg disabled:opacity-40
                       hover:bg-gray-800 transition-colors flex items-center gap-1"
          >
            {loading ? (
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            <span>{loading ? '搜索中' : '搜索'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
