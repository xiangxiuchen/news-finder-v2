import type { NewsArticle, SearchFilters, TimeFilter } from '@/types';

const NEWS_API_BASE = 'https://newsapi.org/v2';

function getApiKey(): string {
  if (typeof process === 'undefined') return '';
  return process.env.NEXT_PUBLIC_NEWS_API_KEY || process.env.NEWS_API_KEY || '';
}

function getTimeRange(time: TimeFilter): string {
  const now = new Date();
  switch (time) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case '3d':
      return new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    case '1w':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case 'all':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }
}

export async function searchNews(
  query: string,
  filters: SearchFilters
): Promise<{ articles: NewsArticle[]; totalResults: number }> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      articles: [],
      totalResults: 0,
    };
  }

  const params = new URLSearchParams({
    q: query,
    from: getTimeRange(filters.time),
    sortBy: filters.sortBy,
    language: 'zh',
    pageSize: '30',
    apiKey,
  });

  const res = await fetch(`${NEWS_API_BASE}/everything?${params}`, {
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'NewsAPI request failed' }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return {
    articles: data.articles || [],
    totalResults: data.totalResults || 0,
  };
}

export async function getTopHeadlines(
  category?: string
): Promise<{ articles: NewsArticle[]; totalResults: number }> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return { articles: [], totalResults: 0 };
  }

  const params = new URLSearchParams({
    language: 'zh',
    pageSize: '30',
    apiKey,
  });
  if (category) params.set('category', category);

  const res = await fetch(`${NEWS_API_BASE}/top-headlines?${params}`, {
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'NewsAPI request failed' }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return {
    articles: data.articles || [],
    totalResults: data.totalResults || 0,
  };
}

export { getApiKey, getTimeRange };
