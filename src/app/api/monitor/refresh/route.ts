import { NextResponse } from 'next/server';
import { searchNews } from '@/lib/news-api';

const JINA = 'https://r.jina.ai';
const ALL_BRANDS = ['Litime', 'EcoWorthy', 'Redodo Power', 'Wattcycle', 'Renogy', 'Battle Born'];
const CATEGORIES = ['golf cart battery', 'lithium battery', 'marine battery', 'solar inverter battery', '48V battery'];

async function jina(url: string) {
  try {
    const r = await fetch(`${JINA}/${encodeURI(url)}`, {
      headers: { 'Accept': 'text/plain' }, signal: AbortSignal.timeout(6000),
    });
    return r.ok ? await r.text() : '';
  } catch { return ''; }
}

/**
 * GET /api/monitor/refresh
 * Designed to be called by cron-job.org every morning.
 * Runs a full competitive scan and returns a JSON report.
 */
export async function GET() {
  const startTime = Date.now();
  const results: any[] = [];

  for (const brand of ALL_BRANDS) {
    const brandResult: any = { brand, news: [], youtube: [], reddit: [], amazon: [] };

    // News
    try {
      const r = await searchNews(`${brand} battery`, { time: '24h', sortBy: 'publishedAt' });
      brandResult.news = (r.articles || []).slice(0, 8).map((a: any) => ({
        title: a.title, url: a.url, source: a.source?.name, date: a.publishedAt,
        isNew: /new|launch|announc|introduc|release|upgrade/i.test(a.title),
      }));
    } catch {}

    // YouTube
    try {
      const text = await jina(`https://www.google.com/search?q=${encodeURIComponent(`site:youtube.com ${brand} battery 2026`)}`);
      const lines = text.split('\n').filter((l: string) => l.includes('youtube.com/watch'));
      brandResult.youtube = lines.slice(0, 5).map((l: string) => {
        const m = l.match(/https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[a-zA-Z0-9_-]+/);
        return m ? { url: m[0], title: l.replace(/https?:\/\/[^\s]+/g, '').trim().slice(0, 80) } : null;
      }).filter(Boolean);
    } catch {}

    // Reddit
    try {
      const text = await jina(`https://www.google.com/search?q=${encodeURIComponent(`site:reddit.com ${brand} battery`)}`);
      brandResult.reddit = text.split('\n').filter((l: string) => l.includes('reddit.com/r/') && l.length < 300).slice(0, 5).map((l: string) => {
        const m = l.match(/https?:\/\/[^\s)]+/);
        return m ? { url: m[0], title: l.replace(/https?:\/\/[^\s]+/g, '').trim().slice(0, 100) } : null;
      }).filter(Boolean);
    } catch {}

    // Amazon
    try {
      const text = await jina(`https://www.amazon.com/s?k=${encodeURIComponent(`${brand} battery`)}`);
      brandResult.amazon = text.split('\n').filter((l: string) => l.includes('$') && l.toLowerCase().includes('battery')).slice(0, 3).map((l: string) => {
        const pm = l.match(/\$[\d,.]+/);
        return pm ? { title: l.replace(/\$[\d,.]+/g, '').trim().slice(0, 80), price: pm[0] } : null;
      }).filter(Boolean);
    } catch {}

    results.push(brandResult);
  }

  // Count new products
  const totalNew = results.reduce((s: number, r: any) => s + r.news.filter((n: any) => n.isNew).length, 0);

  return NextResponse.json({
    refreshedAt: new Date().toISOString(),
    elapsed: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
    brands: results,
    summary: {
      brandsScanned: ALL_BRANDS.length,
      totalNews: results.reduce((s: number, r: any) => s + r.news.length, 0),
      totalYouTube: results.reduce((s: number, r: any) => s + r.youtube.length, 0),
      totalReddit: results.reduce((s: number, r: any) => s + r.reddit.length, 0),
      totalAmazon: results.reduce((s: number, r: any) => s + r.amazon.length, 0),
      newProductSignals: totalNew,
    },
  });
}
