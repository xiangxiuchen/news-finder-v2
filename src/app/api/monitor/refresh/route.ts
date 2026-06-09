import { NextResponse } from 'next/server';
import { searchNews } from '@/lib/news-api';

const JINA = 'https://r.jina.ai';
// Vercel free tier = 10s timeout, scan only 3 brands with quick lookups
const BRANDS = ['Litime', 'Renogy', 'Battle Born'];
const Q = async (url: string) => {
  try {
    const r = await fetch(`${JINA}/${encodeURI(url)}`, {
      headers: { 'Accept': 'text/plain' }, signal: AbortSignal.timeout(5000),
    });
    return r.ok ? await r.text() : '';
  } catch { return ''; }
};

export async function GET() {
  const start = Date.now();
  const results: any[] = [];
  const brandList = BRANDS;

  // Scan each brand (sequential to avoid flooding)
  for (const brand of brandList) {
    const b: any = { brand, news: [], youtube: [], reddit: [], amazon: [] };

    try {
      const r = await searchNews(`${brand} battery`, { time: '24h', sortBy: 'publishedAt' });
      b.news = (r.articles || []).slice(0, 4).map((a: any) => ({
        title: a.title, url: a.url, source: a.source?.name, date: a.publishedAt,
        isNew: /new|launch|announc|introduc|release|upgrade/i.test(a.title),
      }));
    } catch {}

    try {
      const t = await Q(`https://www.google.com/search?q=${encodeURIComponent(`site:youtube.com ${brand} battery`)}`);
      b.youtube = t.split('\n').filter((l: string) => l.includes('youtube.com/watch')).slice(0, 3).map((l: string) => {
        const m = l.match(/https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[a-zA-Z0-9_-]+/);
        return m ? { url: m[0], title: l.replace(/https?:\/\/[^\s]+/g, '').trim().slice(0, 60) } : null;
      }).filter(Boolean);
    } catch {}

    try {
      const t = await Q(`https://www.google.com/search?q=${encodeURIComponent(`site:reddit.com ${brand} battery`)}`);
      b.reddit = t.split('\n').filter((l: string) => l.includes('reddit.com/r/')).slice(0, 3).map((l: string) => {
        const m = l.match(/https?:\/\/[^\s)]+/);
        return m ? { url: m[0], title: l.replace(/https?:\/\/[^\s]+/g, '').trim().slice(0, 60) } : null;
      }).filter(Boolean);
    } catch {}

    try {
      const t = await Q(`https://www.amazon.com/s?k=${encodeURIComponent(`${brand} battery`)}`);
      b.amazon = t.split('\n').filter((l: string) => l.includes('$') && l.toLowerCase().includes('battery')).slice(0, 2).map((l: string) => {
        const pm = l.match(/\$[\d,.]+/);
        return pm ? { title: l.replace(/\$[\d,.]+/g, '').trim().slice(0, 60), price: pm[0] } : null;
      }).filter(Boolean);
    } catch {}

    results.push(b);
  }

  const elapsed = Date.now() - start;
  return NextResponse.json({
    refreshedAt: new Date().toISOString(),
    elapsed: `${(elapsed / 1000).toFixed(1)}s`,
    totalTimeMs: elapsed,
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
