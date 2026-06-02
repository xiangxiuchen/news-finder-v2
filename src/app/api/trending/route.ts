import { NextResponse } from 'next/server';
import { getTopHeadlines, getApiKey } from '@/lib/news-api';

export async function GET() {
  const key = getApiKey();
  if (!key) {
    return NextResponse.json({
      articles: [],
      totalResults: 0,
      needsConfig: true,
      source: 'NewsAPI',
    });
  }

  try {
    const result = await getTopHeadlines();
    return NextResponse.json({ ...result, needsConfig: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取热点失败';
    return NextResponse.json({ articles: [], totalResults: 0, error: message, needsConfig: false }, { status: 500 });
  }
}
