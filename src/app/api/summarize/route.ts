import { NextRequest, NextResponse } from 'next/server';
import { generateSummary } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const { title, content } = await request.json();

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: '缺少标题或内容' }, { status: 400 });
    }

    const result = await generateSummary(title, content);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : '摘要生成失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
