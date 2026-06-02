const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
const DEEPSEEK_API = 'https://api.deepseek.com/v1/chat/completions';

type Provider = 'claude' | 'deepseek';

function getConfig() {
  const provider = (process.env.AI_PROVIDER || 'claude') as Provider;
  const claudeKey = process.env.CLAUDE_API_KEY || '';
  const deepseekKey = process.env.DEEPSEEK_API_KEY || '';

  if (provider === 'deepseek' && !deepseekKey) {
    return { provider, apiKey: '', error: '请在 .env.local 中设置 DEEPSEEK_API_KEY' };
  }
  if (provider === 'claude' && !claudeKey) {
    return { provider, apiKey: '', error: '请在 .env.local 中设置 CLAUDE_API_KEY' };
  }

  return {
    provider,
    apiKey: provider === 'deepseek' ? deepseekKey : claudeKey,
    error: null,
  };
}

interface CallOptions {
  system: string;
  userMessage: string;
  maxTokens?: number;
  expectJson?: boolean;
}

export async function callAI(options: CallOptions): Promise<string> {
  const { provider, apiKey, error: configError } = getConfig();

  if (configError || !apiKey) {
    throw new Error(configError || 'AI 未配置');
  }

  if (provider === 'deepseek') {
    const body: Record<string, unknown> = {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.userMessage },
      ],
      max_tokens: options.maxTokens || 1000,
      stream: false,
    };

    if (options.expectJson) {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch(DEEPSEEK_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`DeepSeek API 错误 (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // Claude
  const res = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: options.maxTokens || 1000,
      system: options.system,
      messages: [{ role: 'user', content: options.userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API 错误 (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

export function isAIConfigured(): boolean {
  const { provider, apiKey } = getConfig();
  return !!apiKey;
}

export function getProvider(): Provider {
  return getConfig().provider;
}
