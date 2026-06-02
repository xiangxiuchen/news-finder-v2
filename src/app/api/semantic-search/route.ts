import { NextRequest, NextResponse } from 'next/server';
import { semanticSearch } from '@/lib/ai';
import { searchNews } from '@/lib/news-api';
import type { TimeFilter, SortBy } from '@/types';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q');

  if (!q?.trim()) {
    return NextResponse.json({ articles: [], totalResults: 0 });
  }

  try {
    // Step 1: AI parses the vague query into search params
    const parsed = await semanticSearch(q);

    // Step 2: Search with the extracted keywords
    const keyword = parsed.keywords.join(' ');
    const result = await searchNews(keyword, {
      time: parsed.timeFilter as TimeFilter,
      sortBy: parsed.sortBy as SortBy,
    });

    return NextResponse.json({
      ...result,
      parsedQuery: parsed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '语义搜索失败';
    return NextResponse.json({ articles: [], totalResults: 0, error: message }, { status: 500 });
  }
}
