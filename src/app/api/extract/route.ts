import { NextRequest, NextResponse } from 'next/server';

const JINA_READER = 'https://r.jina.ai';

/** Extract YouTube video ID from various URL formats */
function getYouTubeID(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/** Extract Bilibili video ID (BV号) */
function getBilibiliBV(url: string): string | null {
  const m = url.match(/\/video\/(BV[a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}

/** Search the web for a video's description/content (last resort) */
async function searchVideoContent(query: string): Promise<string> {
  const searchUrl = `${JINA_READER}/https://www.google.com/search?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(searchUrl);
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
