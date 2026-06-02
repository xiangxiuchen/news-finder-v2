import { callAI, isAIConfigured } from './ai-client';

export async function translateText(
  title: string,
  description: string
): Promise<{ title: string; description: string }> {
  if (!isAIConfigured()) {
    return { title: '请配置 AI API Key 以使用翻译功能', description: '' };
  }

  try {
    const text = await callAI({
      system: `你是一个翻译助手。将英文新闻标题和摘要翻译成流畅的中文。

输出 JSON 格式：
{
  "title": "翻译后的标题",
  "description": "翻译后的摘要"
}

要求：
- 翻译准确、自然、符合中文阅读习惯
- 专有名词保留英文，括号内加中文译名
- 标题翻译简洁有力，摘要翻译完整传达原意`,
      userMessage: `标题：${title}\n\n摘要：${description || '(无摘要)'}`,
      maxTokens: 500,
      expectJson: true,
    });

    const parsed = JSON.parse(text);
    return {
      title: parsed.title || title,
      description: parsed.description || description,
    };
  } catch {
    return { title: '翻译失败，请稍后重试', description: '' };
  }
}

/** Check if text is primarily English (more than 60% ASCII letters) */
export function isEnglish(text: string): boolean {
  if (!text) return false;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  return latin / text.length > 0.6;
}
