import { NextResponse } from 'next/server';
import { searchNews, getApiKey } from '@/lib/news-api';

export async function GET() {
  const key = getApiKey();
  if (!key) {
    return NextResponse.json({
      articles: [],
      totalResults: 0,
      needsConfig: true,
    });
  }

  try {
    // Search for AI news — use English query for better NewsAPI results
    const result = await searchNews('AI', {
      time: '24h',
      sortBy: 'popularity',
    });

    // If not enough results from 24h, expand to 3 days
    let articles = result.articles;
    if (articles.length < 20) {
      const weekResult = await searchNews('AI', {
        time: '3d',
        sortBy: 'popularity',
      });
      // Deduplicate
      const seen = new Set(articles.map(a => a.url));
      for (const a of weekResult.articles) {
        if (!seen.has(a.url)) { articles.push(a); seen.add(a.url); }
      }
    }

    return NextResponse.json({ articles: articles.slice(0, 20), totalResults: articles.length, needsConfig: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取热点失败';
    return NextResponse.json({ articles: [], totalResults: 0, error: message, needsConfig: false }, { status: 500 });
  }
}
