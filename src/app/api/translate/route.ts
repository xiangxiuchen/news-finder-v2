import { NextRequest, NextResponse } from 'next/server';
import { translateText } from '@/lib/translate';

export async function POST(request: NextRequest) {
  try {
    const { title, description } = await request.json();
    if (!title?.trim()) {
      return NextResponse.json({ error: '缺少标题' }, { status: 400 });
    }

    const result = await translateText(title, description || '');
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : '翻译失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
