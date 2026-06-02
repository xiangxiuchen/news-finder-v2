import { NextRequest, NextResponse } from 'next/server';
import { searchNews } from '@/lib/news-api';
import type { TimeFilter, SortBy } from '@/types';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q');
  const time = (searchParams.get('time') || '1w') as TimeFilter;
  const sortBy = (searchParams.get('sortBy') || 'publishedAt') as SortBy;

  if (!q?.trim()) {
    return NextResponse.json({ articles: [], totalResults: 0 });
  }

  try {
    const result = await searchNews(q, { time, sortBy });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : '搜索失败';
    return NextResponse.json({ articles: [], totalResults: 0, error: message }, { status: 500 });
  }
}
