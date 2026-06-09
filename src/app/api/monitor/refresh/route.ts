import { NextResponse } from 'next/server';
import { searchNews } from '@/lib/news-api';

const JINA = 'https://r.jina.ai';
// Vercel free tier = 10s timeout, scan only 3 brands with quick lookups
const BRANDS = ['Litime', 'Renogy', 'Battle Born'];
const Q = async (url: string) => {
  try {
    const r = await fetch(`${JINA}/${encodeURI(url)}`, {
      headers: { 'Accept': 'text/plain', 'X-With-Links-Summary': 'true' }, signal: AbortSignal.timeout(8000),
    });
    return r.ok ? await r.text() : '';
  } catch { return ''; }
};

export async function GET() {
  const start = Date.now();

  // Parallel: all brands × all sources
  const results = await Promise.all(BRANDS.map(async (brand) => {
    const [newsRes, youtubeRes, redditRes, amazonRes] = await Promise.all([
      searchNews(`${brand} battery`, { time: '24h', sortBy: 'publishedAt' }).catch(() => ({ articles: [] })),
      Q(`https://www.google.com/search?q=${encodeURIComponent(`site:youtube.com ${brand} battery`)}`).catch(() => ''),
      Q(`https://www.google.com/search?q=${encodeURIComponent(`site:reddit.com ${brand} battery`)}`).catch(() => ''),
      Q(`https://www.amazon.com/s?k=${encodeURIComponent(`${brand} battery`)}`).catch(() => ''),
    ]);

    const news = (newsRes.articles || []).slice(0, 4).map((a: any) => ({
      title: a.title, url: a.url, source: a.source?.name, date: a.publishedAt,
      isNew: /new|launch|announc|introduc|release|upgrade/i.test(a.title),
    }));

    const parseLinks = (text: string, pattern: RegExp) =>
      text.split('\n').filter(l => pattern.test(l)).slice(0, 3).map(l => {
        const m = l.match(pattern);
        return m ? { url: m[0], title: l.replace(/https?:\/\/[^\s]+/g, '').trim().slice(0, 60) } : null;
      }).filter(Boolean);

    return {
      brand,
      news,
      youtube: parseLinks(youtubeRes, /youtube\.com\/watch\?v=[a-zA-Z0-9_-]+/),
      reddit: parseLinks(redditRes, /https?:\/\/[^\s)]+reddit\.com\/r\/[^\s)]+/),
      amazon: amazonRes.split('\n').filter(l => l.includes('$') && l.toLowerCase().includes('battery')).slice(0, 2).map(l => {
        const pm = l.match(/\$[\d,.]+/);
        return pm ? { title: l.replace(/\$[\d,.]+/g, '').trim().slice(0, 60), price: pm[0] } : null;
      }).filter(Boolean),
    };
  }));

  const elapsed = Date.now() - start;
  return NextResponse.json({
    refreshedAt: new Date().toISOString(),
    elapsed: `${(elapsed / 1000).toFixed(1)}s`,
    brands: results,
    summary: {
      brandsScanned: results.length,
      news: results.reduce((s: number, r: any) => s + r.news.length, 0),
      youtube: results.reduce((s: number, r: any) => s + r.youtube.length, 0),
      reddit: results.reduce((s: number, r: any) => s + r.reddit.length, 0),
      amazon: results.reduce((s: number, r: any) => s + r.amazon.length, 0),
      newSignals: results.reduce((s: number, r: any) => s + r.news.filter((n: any) => n.isNew).length, 0),
    },
  });
}
