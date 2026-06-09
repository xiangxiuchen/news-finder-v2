import { NextRequest, NextResponse } from 'next/server';
import { searchNews } from '@/lib/news-api';

const JINA_READER = 'https://r.jina.ai';
const NEW_KEYWORDS = ['new', 'launch', 'announc', 'introduc', 'release', 'upgrade', 'v2', 'pro', '全新', '发布', '新品'];

const ALL_BRANDS = ['Litime', 'EcoWorthy', 'Redodo Power', 'Wattcycle', 'Renogy', 'Battle Born', 'Dakota Lithium'];

function isNew(text: string): boolean {
  const l = text.toLowerCase();
  return NEW_KEYWORDS.some(k => l.includes(k));
}

async function fetchJina(url: string): Promise<string> {
  const res = await fetch(`${JINA_READER}/${encodeURI(url)}`, {
    headers: { 'Accept': 'text/plain' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return '';
  return await res.text();
}

// ===== Monitor single brand =====
async function monitorBrand(brand: string, category: string) {
  const query = `${brand} ${category} battery`;

  // 1. NewsAPI
  let news: { title: string; url: string; source: string; date: string; isNew: boolean }[] = [];
  try {
    const result = await searchNews(query, { time: '1w', sortBy: 'publishedAt' });
    news = (result.articles || []).slice(0, 5).map(a => ({
      title: a.title, url: a.url, source: a.source.name, date: a.publishedAt, isNew: isNew(a.title),
    }));
  } catch {}

  // 2. Reddit (via Google search)
  let reddit: { title: string; url: string; snippet: string }[] = [];
  try {
    const text = await fetchJina(`https://www.google.com/search?q=${encodeURIComponent(`site:reddit.com ${brand} battery review`)}`);
    const lines = text.split('\n').filter(l => l.includes('reddit.com') && l.length < 200);
    for (const line of lines.slice(0, 3)) {
      const m = line.match(/https?:\/\/(?:[^/\s]+\.)?reddit\.com\/[^\s)]+/);
      if (m) reddit.push({ title: line.replace(/https?:\/\/[^\s]+/g, '').trim().slice(0, 80), url: m[0], snippet: line.slice(0, 150) });
    }
  } catch {}

  // 3. Amazon
  let amazon: { title: string; price: string; isNew: boolean }[] = [];
  try {
    const text = await fetchJina(`https://www.amazon.com/s?k=${encodeURIComponent(query)}`);
    const lines = text.split('\n');
    for (const line of lines) {
      const pm = line.match(/\$[\d,.]+/);
      if (pm && (line.toLowerCase().includes('battery') || line.toLowerCase().includes(brand.split(' ')[0].toLowerCase())) && line.length < 200) {
        amazon.push({ title: line.replace(/\$[\d,.]+/g, '').trim().slice(0, 100), price: pm[0], isNew: isNew(line) });
        if (amazon.length >= 3) break;
      }
    }
  } catch {}

  // 4. Brand website
  let website: { title: string; url: string }[] = [];
  try {
    const domain = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
    const urls = [`https://www.${domain}.com/blogs/news`, `https://www.${domain}.com/blogs`];
    for (const u of urls) {
      const text = await fetchJina(u);
      if (!text) continue;
      for (const line of text.split('\n').filter(l => l.trim().length > 10 && l.trim().length < 150)) {
        if (isNew(line) && !website.some(w => w.title === line.trim())) {
          website.push({ title: line.trim().slice(0, 100), url: u });
          if (website.length >= 2) break;
        }
      }
      if (website.length > 0) break;
    }
  } catch {}

  return { brand, news, reddit, amazon, website, newCount: news.filter(n => n.isNew).length + amazon.filter(a => a.isNew).length };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const brandsParam = searchParams.get('brands');
  const category = searchParams.get('category') || 'battery';
  const generate = searchParams.get('report') === 'true';

  const brands = brandsParam ? brandsParam.split(',').slice(0, 3) : ALL_BRANDS.slice(0, 3);

  // Monitor brands sequentially to avoid timeout
  const results = [];
  for (const brand of brands) {
    const r = await monitorBrand(brand, category);
    results.push(r);
  }

  // Generate AI summary only if requested (and time permits)
  let aiSummary = '';
  if (generate) {
    try {
      const input = results.map(r =>
        `【${r.brand}】新闻:${r.news.map(n=>n.title).join('; ')} | Reddit:${r.reddit.length}条 | Amazon新品:${r.amazon.filter(a=>a.isNew).length}`
      ).join('\n');

      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY || process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: '你是锂电池行业分析师。根据以下数据生成100字以内的竞品摘要，重点标出新品发布和用户负面反馈。' },
            { role: 'user', content: input },
          ],
          max_tokens: 300,
        }),
      });
      const data = await res.json();
      aiSummary = data.choices?.[0]?.message?.content || '';
    } catch { aiSummary = ''; }
  }

  return NextResponse.json({ timestamp: new Date().toISOString(), brands: results, aiSummary });
}
