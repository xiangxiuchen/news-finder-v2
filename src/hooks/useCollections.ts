'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CollectionItem, NewsArticle } from '@/types';

const STORAGE_KEY = 'news-collections';

function loadCollections(): CollectionItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useCollections() {
  const [items, setItemsState] = useState<CollectionItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setItemsState(loadCollections());
    setLoaded(true);
  }, []);

  const save = useCallback((article: NewsArticle) => {
    const newItem: CollectionItem = {
      id: `${article.url}-${Date.now()}`,
      article,
      savedAt: new Date().toISOString(),
    };
    setItemsState((prev) => {
      const exists = prev.some((item) => item.article.url === article.url);
      if (exists) return prev;
      const updated = [newItem, ...prev];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItemsState((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const isSaved = useCallback(
    (url: string) => items.some((item) => item.article.url === url),
    [items]
  );

  const setItems = useCallback((newItems: CollectionItem[]) => {
    setItemsState(newItems);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
  }, []);

  return { items, loaded, save, remove, isSaved, setItems };
}
