import { NextRequest, NextResponse } from 'next/server';

const JINA_READER = 'https://r.jina.ai';
const APIFY_DOUYIN_ACTOR = 'apple_yang~douyin-transcripts-scraper';
const APIFY_YT_ACTOR = 'supreme_coder~youtube-transcript-scraper';
const APIFY_IG_ACTOR = 'linen_snack~instagram-reel-transcript-ai-extractor';
const APIFY_API = 'https://api.apify.com/v2';

function getApifyKey(): string {
  return process.env.APIFY_API_KEY || '';
}

/** Get Douyin transcript via Apify */
async function fetchDouyinViaApify(url: string): Promise<string | null> {
  return fetchViaApify(APIFY_DOUYIN_ACTOR, { videoUrl: url });
}

/** Generic Apify actor runner (sync, may timeout from Vercel) */
async function fetchViaApify(actorId: string, input: Record<string, unknown>): Promise<string | null> {
  const apiKey = getApifyKey();
  if (!apiKey) return null;

  try {
    // Start async run
    const runRes = await fetch(`${APIFY_API}/acts/${actorId}/runs?token=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!runRes.ok) return null;
    const runData = await runRes.json();
    const runId = runData?.data?.id || runData?.id;
    if (!runId) return null;

    // Wait for completion (poll up to 25s)
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const statusRes = await fetch(`${APIFY_API}/actor-runs/${runId}?token=${apiKey}`);
      if (!statusRes.ok) continue;
      const statusData = await statusRes.json();
      const runStatus = statusData?.data?.status || statusData?.status;

      if (runStatus === 'SUCCEEDED') {
        const dsId = statusData?.data?.defaultDatasetId || statusData?.defaultDatasetId;
        if (!dsId) return null;
        const dsRes = await fetch(`${APIFY_API}/datasets/${dsId}/items?token=${apiKey}`);
        if (!dsRes.ok) return null;
        const items = await dsRes.json();
        const record = Array.isArray(items) ? items[0] : items;
        if (!record) return null;

        // Build result text
        let result = '';
        if (record.title) result += `标题：${record.title}\n`;
        if (record.description || record.caption) result += `描述：${record.description || record.caption}\n`;
        // YouTube-specific fields
        if (record.text && typeof record.text === 'string' && record.text.length > 10) {
          result += `\n--- 字幕文本 ---\n${record.text}\n`;
        }
        if (record.transcript && Array.isArray(record.transcript)) {
          const lines = record.transcript
            .filter((s: { text?: string }) => s?.text)
            .map((s: { text?: string }) => String(s.text).replace(/<[^>]+>/g, '').trim());
          if (lines.length > 0) result += `\n--- 逐句字幕 ---\n${lines.join('\n')}\n`;
        }
        // Douyin-specific fields
        if (record.nickname) result += `作者：${record.nickname}\n`;
        if (record.diggCount !== undefined) result += `点赞数：${record.diggCount}\n`;

        if (result.trim().length > 20) return result.trim().slice(0, 10000);
        return null;
      }

      if (['FAILED', 'TIMED-OUT', 'ABORTED'].includes(runStatus)) return null;
      // else still 'RUNNING'
    }
    return null; // timeout
  } catch {
    return null;
  }
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

/** Start Apify run for any actor and return run ID */
async function startApifyRunFor(actorId: string, input: Record<string, unknown>): Promise<string | null> {
  const apiKey = getApifyKey();
  if (!apiKey) return null;
  try {
    const res = await fetch(`${APIFY_API}/acts/${actorId}/runs?token=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.id || data?.id || null;
  } catch { return null; }
}

/** Start Apify Douyin transcription run */
async function startApifyRun(url: string): Promise<string | null> {
  return startApifyRunFor(APIFY_DOUYIN_ACTOR, { videoUrl: url });
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

      // Build result (handle both YouTube and Douyin output formats)
      let result = '';
      if (record.title) result += `标题：${record.title}\n`;
      const desc = record.description || record.caption || '';
      if (desc) result += `描述：${desc}\n`;
      const author = record.nickname || record.channelName || record.author || '';
      if (author) result += `作者：${author}\n`;
      if (record.diggCount !== undefined) result += `点赞数：${record.diggCount}\n`;

      // Text transcript (YouTube Apify format: full transcript as text)
      if (record.text && typeof record.text === 'string' && record.text.length > 10) {
        result += `\n--- 字幕文本 ---\n${record.text}\n`;
      }

      // Segmented transcript (Douyin Apify format)
      if (record.transcript && Array.isArray(record.transcript)) {
        const lines = record.transcript
          .filter((s: { text?: string }) => s?.text)
          .map((s: { start?: number; text?: string }) => {
            const t = s.start ? `[${Math.floor(s.start / 60)}:${(s.start % 60).toFixed(0).padStart(2, '0')}]` : '';
            return `${t} ${String(s.text).replace(/<[^>]+>/g, '').trim()}`;
          });
        if (lines.length > 0) result += `\n--- 逐句字幕 ---\n${lines.join('\n')}\n`;
      }

      if (result.trim().length > 20) return { status: 'completed', text: result.trim().slice(0, 10000) };

      const errMsg = record.errMsg || '';
      if (errMsg) return { status: 'no_transcript', error: errMsg, title: record.title || '', caption: desc };
      return { status: 'no_transcript', error: '未找到字幕', title: record.title || '', caption: desc };
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
    // --- YouTube (async Apify → Jina fallback) ---
    const ytID = getYouTubeID(url!);
    if (ytID) {
      // Try 1: Apify YouTube Transcript Scraper (async, handles IP blocks)
      const apifyKey = getApifyKey();
      if (apifyKey) {
        const runId = await startApifyRunFor(APIFY_YT_ACTOR, { videoUrl: `https://www.youtube.com/watch?v=${ytID}` });
        if (runId) {
          return NextResponse.json({ status: 'processing', runId, message: '正在提取 YouTube 字幕...' });
        }
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
        // Let frontend poll for results
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

    // --- Instagram ---
    if (url!.includes('instagram.com')) {
      const apiKey = getApifyKey();
      if (apiKey) {
        const runId = await startApifyRunFor(APIFY_IG_ACTOR, { reelUrls: [url!] });
        if (runId) {
          return NextResponse.json({ status: 'processing', runId, message: '正在提取 Instagram 视频内容...' });
        }
      }
      // Fallback: Jina Reader
      try {
        const res = await fetch(`${JINA_READER}/${encodeURI(url!)}`, {
          headers: { 'Accept': 'text/plain', 'X-With-Links-Summary': 'true' },
        });
        if (res.ok) {
          const text = await res.text();
          if (text && text.length > 50) {
            return NextResponse.json({ status: 'completed', text: text.slice(0, 5000), source: 'jina_reader' });
          }
        }
      } catch {}
      return NextResponse.json({ status: 'none', text: '', note: '配置 APIFY_API_KEY 可自动提取 Instagram 视频文案' });
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
