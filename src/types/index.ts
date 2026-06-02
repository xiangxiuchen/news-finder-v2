export interface NewsArticle {
  title: string;
  description: string;
  content: string;
  url: string;
  urlToImage: string | null;
  source: { id: string | null; name: string };
  author: string | null;
  publishedAt: string;
}

export interface AISummary {
  summary: string;
  hotAnalysis: string;
  postSuggestions: string[];
}

export type TimeFilter = '24h' | '3d' | '1w' | 'all';
export type SortBy = 'relevancy' | 'popularity' | 'publishedAt';

export interface SearchFilters {
  time: TimeFilter;
  sortBy: SortBy;
}

export interface CollectionItem {
  id: string;
  article: NewsArticle;
  savedAt: string;
}

export interface SearchResult {
  articles: NewsArticle[];
  totalResults: number;
  error?: string;
}
