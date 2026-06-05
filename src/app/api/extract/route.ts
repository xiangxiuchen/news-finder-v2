import { NextRequest, NextResponse } from 'next/server';

const JINA_READER = 'https://r.jina.ai';
const APIFY_ACTOR = 'apple_yang~douyin-transcripts-scraper';
const APIFY_API = 'https://api.apify.com/v2';

function getApifyKey(): string {
  return process.env.APIFY_API_KEY || '';
}

/** Extract YouTube video ID */
function getYouTubeID(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

/** Fetch YouTube transcript directly from YouTube's captions (no API key needed) */
async function fetchYouTubeTranscript(videoId: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    // Step 1: Fetch video page to get caption URLs
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!pageRes.ok) return null;
    const html = await pageRes.text();

    // Step 2: Extract caption tracks from ytInitialPlayerResponse
    const match = html.match(/ytInitialPlayerResponse\s*=\s*({.*?});/);
    if (!match) return null;

    let playerData;
    try { playerData = JSON.parse(match[1]); } catch { return null; }

    const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captionTracks || captionTracks.length === 0) return null;

    // Step 3: Pick the best available track
    let trackUrl = captionTracks[0]?.baseUrl;
    const preferred = ['zh-Hans', 'zh', 'en', 'a.en', 'en-US', 'en-GB'];
    for (const track of captionTracks) {
      const code = track.languageCode || '';
      if (preferred.includes(code)) { trackUrl = track.baseUrl; break; }
    }
    if (!trackUrl) return null;

    // Step 4: Fetch the transcript XML (with 'caps' removed for full text)
    trackUrl = trackUrl.replace(/&caps=[^&]*/, '') + '&fmt=json';
    const trackRes = await fetch(trackUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' },
    });
    if (!trackRes.ok) return null;

    // Step 5: Parse JSON transcript (each entry has 'text' field)
    const json = await trackRes.json();
    const texts: string[] = [];
    if (Array.isArray(json)) {
      for (const entry of json) {
        if (entry?.text?.trim()) {
          texts.push(entry.text.replace(/<[^>]+>/g, '').trim());
        }
      }
    }

    if (texts.length > 3) return texts.join(' ');
    return null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

function decodeHtmlEntities(text: string): string {
  return text.replace(/&#(\d+);/g, (_, c) => String.fromCharCode(c))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

/** Extract Bilibili BV号 */
function getBilibiliBV(url: string): string | null {
  const m = url.match(/\/video\/(BV[a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}

/** Start Apify transcription run (async) and return run ID */
async function startApifyRun(url: string): Promise<string | null> {
  const apiKey = getApifyKey();
  if (!apiKey) return null;

  try {
    const res = await fetch(`${APIFY_API}/acts/${APIFY_ACTOR}/runs?token=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl: url }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.id || data?.id || null;
  } catch {
    return null;
  }
}

/** Poll Apify run result */
async function pollApifyRun(runId: string): Promise<{ status: string; text?: string; error?: string; title?: string; caption?: string }> {
  const apiKey = getApifyKey();
  if (!apiKey) return { status: 'error' };

  try {
    // Check run status
    const statusRes = await fetch(`${APIFY_API}/actor-runs/${runId}?token=${apiKey}`);
    if (!statusRes.ok) return { status: 'error' };
    const statusData = await statusRes.json();
    const runStatus = statusData?.data?.status || statusData?.status;

    if (runStatus === 'SUCCEEDED') {
      // Get dataset items
      const datasetId = statusData?.data?.defaultDatasetId || statusData?.defaultDatasetId;
      if (!datasetId) return { status: 'error' };

      const dataRes = await fetch(`${APIFY_API}/datasets/${datasetId}/items?token=${apiKey}`);
      if (!dataRes.ok) return { status: 'error' };
      const items = await dataRes.json();
      const record = Array.isArray(items) ? items[0] : items;
      if (!record) return { status: 'error' };

      // Build result
      let result = '';
      if (record.title) result += `标题：${record.title}\n`;
      if (record.caption) result += `描述：${record.caption}\n`;
      if (record.nickname) result += `作者：${record.nickname}\n`;
      if (record.diggCount !== undefined) result += `点赞数：${record.diggCount}\n`;

      if (record.text && typeof record.text === 'string' && record.text.length > 10) {
        result += `\n--- 视频文案（逐字稿）---\n${record.text}\n`;
      }

      if (record.transcript && Array.isArray(record.transcript)) {
        const lines = record.transcript
          .filter((s: { text?: string }) => s.text?.trim())
          .map((s: { start?: number; text?: string }) => {
            const t = s.start ? `[${Math.floor(s.start / 60)}:${(s.start % 60).toFixed(0).padStart(2, '0')}]` : '';
            return `${t} ${s.text}`;
          });
        if (lines.length > 0) result += `\n--- 逐句字幕 ---\n${lines.join('\n')}\n`;
      }

      if (result.trim().length > 20) return { status: 'completed', text: result.trim().slice(0, 10000) };
      // Check for explicit error
      const errMsg = record.errMsg || '';
      if (errMsg.includes('no audio') || errMsg.includes('no transcript')) {
        return { status: 'no_transcript', error: errMsg, title: record.title || '', caption: record.caption || '' };
      }
      return { status: 'no_transcript', error: errMsg, title: record.title || '', caption: record.caption || '' };
    }

    if (runStatus === 'FAILED' || runStatus === 'TIMED-OUT' || runStatus === 'ABORTED') {
      return { status: 'failed' };
    }

    // Still running
    return { status: 'processing' };
  } catch {
    return { status: 'error' };
  }
}

/** Try to fetch Douyin video info via Jina Reader (quick fallback) */
async function fetchDouyinFallback(url: string): Promise<string | null> {
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
  const runId = request.nextUrl.searchParams.get('runId');
  if (!url && !runId) {
    return NextResponse.json({ text: '', error: '缺少参数' }, { status: 400 });
  }

  // === Poll existing run ===
  if (runId) {
    const result = await pollApifyRun(runId);
    return NextResponse.json(result);
  }

  try {
    // --- YouTube (try transcript first, then fallback to Jina) ---
    const ytID = getYouTubeID(url!);
    if (ytID) {
      // Try 1: Direct transcript extraction (full spoken content)
      const transcript = await fetchYouTubeTranscript(ytID);
      if (transcript && transcript.length > 100) {
        return NextResponse.json({
          status: 'completed',
          text: transcript.slice(0, 10000),
          source: 'youtube_transcript',
          note: '包含完整字幕文本',
        });
      }

      // Try 2: Jina Reader fallback (page metadata)
      try {
        const res = await fetch(`${JINA_READER}/${encodeURI(url!)}`, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'X-With-Links-Summary': 'true' },
        });
        if (res.ok) {
          const text = await res.text();
          if (text && text.length > 200) {
            return NextResponse.json({ status: 'completed', text: text.slice(0, 5000), source: 'jina_reader' });
          }
        }
      } catch {}
      return NextResponse.json({ status: 'completed', text: `[YouTube 视频] 已提取页面信息`, source: 'youtube' });
    }

    // --- Bilibili ---
    const bvID = getBilibiliBV(url!);
    if (bvID) {
      try {
        const infoRes = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvID}`, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.bilibili.com' },
        });
        if (infoRes.ok) {
          const info = await infoRes.json();
          if (info?.data?.desc || info?.data?.title) {
            const text = `标题：${info.data.title || ''}\n描述：${info.data.desc || ''}\nUP主：${info.data.owner?.name || ''}`;
            return NextResponse.json({ status: 'completed', text: text.slice(0, 5000), source: 'bilibili_api' });
          }
        }
      } catch {}
    }

    // --- Douyin ---
    if (url!.includes('douyin.com') || url!.includes('iesdouyin.com')) {
      const apiKey = getApifyKey();

      if (apiKey) {
        // Start async Apify run
        const runIdResult = await startApifyRun(url!);
        if (runIdResult) {
          return NextResponse.json({ status: 'processing', runId: runIdResult, message: '正在转录视频语音...' });
        }
      }

      // Fallback: try Jina Reader
      const fallbackText = await fetchDouyinFallback(url!);
      if (fallbackText) {
        return NextResponse.json({ status: 'completed', text: fallbackText.slice(0, 5000), source: 'douyin_fallback' });
      }

      if (!apiKey) {
        return NextResponse.json({ status: 'none', text: '', note: '配置 APIFY_API_KEY 可自动提取抖音文案' });
      }
      return NextResponse.json({ status: 'none', text: '', note: '转录启动失败' });
    }

    // --- Generic: Try Jina Reader ---
    try {
      const res = await fetch(`${JINA_READER}/${encodeURI(url!)}`, {
        headers: { 'Accept': 'text/plain', 'X-With-Links-Summary': 'true' },
      });
      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 100) {
          return NextResponse.json({ status: 'completed', text: text.slice(0, 5000), source: 'jina_reader' });
        }
      }
    } catch {}

    // --- Last resort ---
    return NextResponse.json({ status: 'completed', text: `[链接内容] 未能提取到详细内容，请确认链接有效`, source: 'none' });

  } catch (err) {
    return NextResponse.json({ status: 'error', text: '', error: String(err) });
  }
}
