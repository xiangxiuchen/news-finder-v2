import { NextRequest, NextResponse } from 'next/server';

const JINA_READER = 'https://r.jina.ai';
const APIFY_API = 'https://api.apify.com/v2/acts/apple_yang~douyin-transcripts-scraper/run-sync';

/** Get Apify API key from env */
function getApifyKey(): string {
  return process.env.APIFY_API_KEY || '';
}

/** Extract YouTube video ID */
function getYouTubeID(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

/** Extract Bilibili BV号 */
function getBilibiliBV(url: string): string | null {
  const m = url.match(/\/video\/(BV[a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}

/** Extract Douyin video ID */
function getDouyinID(url: string): string | null {
  // Matches: /video/123456, /share/video/123456, or the ID from short URL
  const m = url.match(/\/video\/(\d+)/);
  if (m) return m[1];
  // Try to match any numeric ID in the URL path
  const segments = url.replace(/\/+/g, '/').split('/');
  for (const seg of segments.reverse()) {
    if (/^\d{17,19}$/.test(seg)) return seg;
  }
  return null;
}

/** Fetch Douyin transcript via Apify (speech-to-text) */
async function fetchDouyinViaApify(url: string): Promise<string | null> {
  const apiKey = getApifyKey();
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(`${APIFY_API}?token=${apiKey}&timeout=30000`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl: url }),
      signal: controller.signal,
    });
    clearTimeout(id);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('Apify API error:', res.status, errText.slice(0, 200));
      return null;
    }

    const data = await res.json();
    let result = '';

    // Extract video metadata
    if (data.title) result += `标题：${data.title}\n`;
    if (data.caption) result += `描述：${data.caption}\n`;
    if (data.diggCount !== undefined) result += `点赞数：${data.diggCount}\n`;
    if (data.nickname) result += `作者：${data.nickname}\n`;

    // Extract transcript (the main value)
    if (data.text && typeof data.text === 'string' && data.text.length > 10) {
      result += `\n--- 视频文案（逐字稿）---\n${data.text}\n`;
    }

    // Extract segmented transcript with timestamps
    if (data.transcript && Array.isArray(data.transcript) && data.transcript.length > 0) {
      const lines = data.transcript
        .filter((s: { text?: string }) => s.text?.trim())
        .map((s: { start?: number; end?: number; text?: string }) => {
          const start = s.start ? `[${Math.floor(s.start / 60)}:${(s.start % 60).toFixed(0).padStart(2, '0')}]` : '';
          return `${start} ${s.text}`;
        });
      if (lines.length > 0) {
        result += `\n--- 逐句字幕 ---\n${lines.join('\n')}\n`;
      }
    }

    if (result.trim().length > 20) return result.trim();
    return null;
  } catch (err) {
    console.error('Apify fetch error:', err);
    return null;
  }
}

/** Try to fetch Douyin video info — fallback methods */
async function fetchDouyinFallback(url: string): Promise<string | null> {
  // Try via Jina Reader
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${JINA_READER}/${encodeURI(url)}`, {
      headers: { 'Accept': 'text/plain', 'X-With-Links-Summary': 'true' },
      signal: controller.signal,
    });
    clearTimeout(id);
    if (res.ok) {
      const text = await res.text();
      if (text && text.length > 30) return text;
    }
  } catch {}
  return null;
}

/** Search the web as last resort */
async function searchVideoContent(query: string): Promise<string> {
  try {
    const res = await fetch(`${JINA_READER}/https://www.google.com/search?q=${encodeURIComponent(query)}`);
    if (res.ok) return (await res.text()).slice(0, 3000);
  } catch {}
  return '';
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ text: '', error: '缺少 url 参数' }, { status: 400 });
  }

  try {
    // --- YouTube ---
    const ytID = getYouTubeID(url);
    if (ytID) {
      // Try 1: YouTube transcript API
      try {
        const res = await fetch(`https://youtubetranscript.com/?v=${ytID}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (res.ok) {
          const body = await res.text();
          // Parse the transcript format
          try {
            const lines = body.split('\n').filter(l => l.trim() && !l.includes('['));
            if (lines.length > 3) {
              return NextResponse.json({
                text: lines.join(' '),
                source: 'youtube_transcript',
              });
            }
          } catch {}
        }
      } catch {}

      // Try 2: Use Jina Reader to fetch the YouTube page
      try {
        const res = await fetch(`${JINA_READER}/${encodeURI(url)}`, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'X-With-Links-Summary': 'true' },
        });
        if (res.ok) {
          const text = await res.text();
          if (text && text.length > 200) {
            return NextResponse.json({ text: text.slice(0, 5000), source: 'jina_reader' });
          }
        }
      } catch {}
    }

    // --- Bilibili ---
    const bvID = getBilibiliBV(url);
    if (bvID) {
      try {
        // Bilibili API for video info
        const infoRes = await fetch(
          `https://api.bilibili.com/x/web-interface/view?bvid=${bvID}`,
          { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.bilibili.com' } }
        );
        if (infoRes.ok) {
          const info = await infoRes.json();
          if (info?.data?.desc || info?.data?.title) {
            let text = `标题：${info.data.title || ''}\n描述：${info.data.desc || ''}`;
            // Try to get subtitles
            if (info.data?.cid) {
              try {
                const subRes = await fetch(
                  `https://api.bilibili.com/x/web-interface/view?bvid=${bvID}`,
                  { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.bilibili.com' } }
                );
                // Subtitle data might be available
              } catch {}
            }
            return NextResponse.json({ text: text.slice(0, 5000), source: 'bilibili_api' });
          }
        }
      } catch {}
    }

    // --- Douyin (try Apify first, then fallback) ---
    if (url.includes('douyin.com') || url.includes('iesdouyin.com')) {
      // Try Apify transcription service (if configured)
      const apifyText = await fetchDouyinViaApify(url);
      if (apifyText) {
        return NextResponse.json({ text: apifyText.slice(0, 10000), source: 'apify_douyin_transcript' });
      }

      // Fallback: try Jina Reader
      const fallbackText = await fetchDouyinFallback(url);
      if (fallbackText) {
        return NextResponse.json({ text: fallbackText.slice(0, 5000), source: 'douyin_fallback' });
      }

      // Return empty (frontend will show manual input)
      return NextResponse.json({ text: '', source: 'none', note: '抖音内容提取需要配置 Apify API Key' });
    }

    // --- Generic: Try Jina Reader (works for news and some video pages) ---
    try {
      const res = await fetch(`${JINA_READER}/${encodeURI(url)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'X-With-Links-Summary': 'true',
          'X-With-Images-Summary': 'true',
        },
      });
      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 100) {
          return NextResponse.json({ text: text.slice(0, 5000), source: 'jina_reader' });
        }
      }
    } catch {}

    // --- Last resort: search for the URL content ---
    const platform = url.includes('douyin') ? '抖音' :
                     url.includes('bilibili') ? 'B站' :
                     url.includes('youtube') || url.includes('youtu.be') ? 'YouTube' : '网页';
    const searchText = await searchVideoContent(`${platform} ${url.split('?')[0].split('/').slice(-1)[0]}`);

    return NextResponse.json({
      text: searchText || '',
      source: searchText ? 'web_search' : 'none',
      platform,
    });
  } catch (err) {
    return NextResponse.json({ text: '', error: String(err), platform: 'unknown' });
  }
}
