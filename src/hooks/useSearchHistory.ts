'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'news-search-history';
const MAX_ITEMS = 8;

interface SearchHistoryItem {
  query: string;
  mode: 'basic' | 'semantic';
  timestamp: number;
}

function load(): SearchHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useSearchHistory() {
  const [items, setItems] = useState<SearchHistoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setItems(load());
    setLoaded(true);
  }, []);

  const add = useCallback((query: string, mode: 'basic' | 'semantic') => {
    setItems((prev) => {
      const filtered = prev.filter((item) => item.query !== query);
      const updated = [{ query, mode, timestamp: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setItems([]);
  }, []);

  return { items, loaded, add, clear };
}
