import { NextRequest, NextResponse } from 'next/server';
import { searchNews } from '@/lib/news-api';

const JINA = 'https://r.jina.ai';
const NEW_KW = ['new', 'launch', 'announc', 'introduc', 'release', 'upgrade', 'v2', 'pro'];

function isNew(t: string) { const l = t.toLowerCase(); return NEW_KW.some(k => l.includes(k)); }

async function jina(url: string, timeout = 8000): Promise<string> {
  try {
    const r = await fetch(`${JINA}/${encodeURI(url)}`, {
      headers: { 'Accept': 'text/plain' },
      signal: AbortSignal.timeout(timeout),
    });
    return r.ok ? await r.text() : '';
  } catch { return ''; }
}

async function callAI(system: string, msg: string): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return '';
  try {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: system }, { role: 'user', content: msg }], max_tokens: 400 }),
    });
    const d = await r.json();
    return d.choices?.[0]?.message?.content || '';
  } catch { return ''; }
}

// ===== Monitor One Brand =====
async function monitorBrand(brand: string, cat: string) {
  const q = `${brand} ${cat} battery`;

  // 1. News
  let news: any[] = [];
  try {
    const r = await searchNews(q, { time: '1w', sortBy: 'publishedAt' });
    news = (r.articles || []).slice(0, 5).map(a => ({ title: a.title, url: a.url, src: a.source.name, date: a.publishedAt, isNew: isNew(a.title) }));
  } catch {}

  // 2. YouTube — search for review videos
  let youtube: { title: string; url: string; channel: string; date: string }[] = [];
  try {
    const text = await jina(`https://www.google.com/search?q=${encodeURIComponent(`site:youtube.com ${brand} battery review 2026`)}`, 10000);
    const lines = text.split('\n').filter(l => l.includes('youtube.com/watch') || l.includes('youtu.be/'));
    for (const line of lines.slice(0, 6)) {
      const urlM = line.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]+/);
      const channelM = line.match(/- (.+?) - YouTube/) || line.match(/(?:by|via)\s+@?([a-zA-Z0-9_]+)/i);
      if (urlM) {
        youtube.push({
          title: line.replace(/https?:\/\/[^\s]+/g, '').replace(/[-|]/g, '').trim().slice(0, 80) || brand + ' review',
          url: urlM[0],
          channel: channelM ? channelM[1].trim() : '',
          date: '',
        });
      }
    }
  } catch {}

  // 3. Reddit — search for user discussions
  let reddit: { title: string; url: string; snippet: string; sentiment?: string }[] = [];
  try {
    const text = await jina(`https://www.google.com/search?q=${encodeURIComponent(`site:reddit.com ${brand} battery review`)}`, 10000);
    const lines = text.split('\n').filter(l => l.includes('reddit.com') && l.length < 300);
    for (const line of lines.slice(0, 5)) {
      const m = line.match(/https?:\/\/(?:[^/\s]+\.)?reddit\.com\/[^\s)]+/);
      if (m) reddit.push({ title: line.replace(/https?:\/\/[^\s]+/g, '').trim().slice(0, 100), url: m[0], snippet: line.slice(0, 200) });
    }
  } catch {}

  // 4. Amazon — search for products with prices
  let amazon: { title: string; price: string; rating: string; reviewCount: string; isNew: boolean }[] = [];
  try {
    const text = await jina(`https://www.amazon.com/s?k=${encodeURIComponent(q)}`, 10000);
    const lines = text.split('\n');
    for (const line of lines) {
      const pm = line.match(/\$[\d,.]+/);
      if (pm && (line.toLowerCase().includes('battery') || line.includes(brand.split(' ')[0])) && line.length < 200) {
        const stars = line.match(/([\d.]+)\s*out of\s*5\s*stars/i);
        const reviews = line.match(/([\d,]+)\s*ratings/i);
        amazon.push({
          title: line.replace(/\$[\d,.]+/g, '').trim().slice(0, 100),
          price: pm[0],
          rating: stars ? stars[1] : '',
          reviewCount: reviews ? reviews[1] : '',
          isNew: isNew(line),
        });
        if (amazon.length >= 4) break;
      }
    }
  } catch {}

  // 5. Brand website news
  let website: { title: string; url: string }[] = [];
  try {
    const domain = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const u of [`https://www.${domain}.com/blogs/news`, `https://www.${domain}.com/blogs`]) {
      const text = await jina(u, 6000);
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

  // 6. AI sentiment analysis for Reddit + Amazon
  let sentiment = '';
  const feedbackText = [
    ...reddit.map(r => `[Reddit] ${r.title}`),
    ...amazon.map(a => `[Amazon] ${a.title} (${a.rating ? a.rating + '星' : '无评分'})`),
  ].join('\n');

  if (feedbackText.length > 20) {
    sentiment = await callAI(
      '你是锂电池产品分析师。分析以下用户反馈，给出简短结论：用户整体满意还是不满意？主要槽点是什么？亮点是什么？不超过80字。',
      feedbackText
    );
  }

  return {
    brand, news, youtube, reddit, amazon, website, sentiment,
    newCount: news.filter((n: any) => n.isNew).length + amazon.filter((a: any) => a.isNew).length + website.length,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const brands = (searchParams.get('brands') || 'Litime,EcoWorthy,Redodo Power,Wattcycle,Renogy,Battle Born').split(',').slice(0, 4);
  const cat = searchParams.get('category') || 'battery';
  const generate = searchParams.get('report') === 'true';

  const results = [];
  for (const b of brands) {
    results.push(await monitorBrand(b, cat));
  }

  let aiSummary = '';
  if (generate) {
    const input = results.map((r: any) =>
      `【${r.brand}】新闻${r.news.length} YouTube${r.youtube.length} Reddit${r.reddit.length} Amazon${r.amazon.length} 新品${r.newCount} | ${r.sentiment || ''}`
    ).join('\n');
    aiSummary = await callAI(
      '你是一个锂电池行业分析师。根据以下各品牌监测数据，生成一份200字以内的竞品周报摘要。按重要程度排序，新品发布用🆕标记，用户负面反馈用⚠️标记。',
      input
    );
  }

  return NextResponse.json({ timestamp: new Date().toISOString(), brands: results, aiSummary });
}
