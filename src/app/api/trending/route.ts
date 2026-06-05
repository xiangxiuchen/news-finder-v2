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
    // Search for AI-related news from the last 24h, sorted by popularity
    const result = await searchNews('AI 人工智能', {
      time: '24h',
      sortBy: 'popularity',
    });

    // If not enough results, also search in English and merge
    if (result.articles.length < 20) {
      const enResult = await searchNews('artificial intelligence', {
        time: '24h',
        sortBy: 'popularity',
      });
      // Merge, deduplicate by URL, keep AI topic first
      const seen = new Set(result.articles.map(a => a.url));
      const merged = [...result.articles];
      for (const article of enResult.articles) {
        if (!seen.has(article.url)) {
          merged.push(article);
          seen.add(article.url);
        }
      }
      return NextResponse.json({ articles: merged.slice(0, 20), totalResults: merged.length, needsConfig: false });
    }

    return NextResponse.json({ ...result, needsConfig: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取热点失败';
    return NextResponse.json({ articles: [], totalResults: 0, error: message, needsConfig: false }, { status: 500 });
  }
}
