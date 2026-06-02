import { callAI, isAIConfigured } from './ai-client';

interface SemanticSearchResult {
  keywords: string[];
  timeFilter: string;
  sortBy: string;
}

export async function semanticSearch(query: string): Promise<SemanticSearchResult> {
  if (!isAIConfigured()) {
    return { keywords: [query], timeFilter: '1w', sortBy: 'publishedAt' };
  }

  try {
    const text = await callAI({
      system: `你是一个新闻搜索意图分析助手。分析用户的自然语言查询，提取出适合新闻搜索的关键词、时间范围和排序方式。

输出 JSON 格式（不要包含其他内容）：
{
  "keywords": ["关键词1", "关键词2"],
  "timeFilter": "24h | 3d | 1w | all",
  "sortBy": "relevancy | popularity | publishedAt"
}

规则：
- keywords: 提取1-3个核心搜索词，中文
- timeFilter: 提到"最新"或"今天"用24h，"最近"或"近几天"用3d，"近一周"用1w，否则默认1w
- sortBy: 关注热度用popularity，关注最新用publishedAt，默认relevancy`,
      userMessage: query,
      maxTokens: 300,
      expectJson: true,
    });

    const parsed = JSON.parse(text);
    return {
      keywords: parsed.keywords || [query],
      timeFilter: parsed.timeFilter || '1w',
      sortBy: parsed.sortBy || 'publishedAt',
    };
  } catch {
    return { keywords: [query], timeFilter: '1w', sortBy: 'publishedAt' };
  }
}

interface SummaryResult {
  summary: string;
  hotAnalysis: string;
  postSuggestions: string[];
}

export async function generateSummary(title: string, content: string): Promise<SummaryResult> {
  if (!isAIConfigured()) {
    return {
      summary: '请配置 AI API Key 以使用选题提炼功能。',
      hotAnalysis: '',
      postSuggestions: ['在项目根目录编辑 .env.local 文件，设置 CLAUDE_API_KEY 或 DEEPSEEK_API_KEY'],
    };
  }

  const truncated = content.length > 3000 ? content.slice(0, 3000) + '...' : content;

  try {
    const text = await callAI({
      system: `你是一个为内容创作者服务的新闻分析助手。根据提供的新闻内容生成三部分内容，输出 JSON 格式：

{
  "summary": "300字以内核心事实摘要",
  "hotAnalysis": "舆论爆点分析",
  "postSuggestions": ["切入点1", "切入点2", "切入点3"]
}

要求：
- summary：简洁有力，概括事件核心要素（5W1H）
- hotAnalysis：分析新闻中的冲突点、情绪点、利益相关方、社会共鸣点
- postSuggestions：给出3个针对内容创作者的独特发帖视角`,
      userMessage: `标题：${title}\n\n正文：${truncated}`,
      maxTokens: 1000,
      expectJson: true,
    });

    return JSON.parse(text);
  } catch {
    return {
      summary: 'AI 解析暂时不可用，请稍后重试。',
      hotAnalysis: '',
      postSuggestions: [],
    };
  }
}
