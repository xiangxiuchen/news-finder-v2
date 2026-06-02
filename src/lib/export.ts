import type { NewsArticle } from '@/types';

function articleToMarkdown(a: NewsArticle, index: number): string {
  const date = new Date(a.publishedAt).toLocaleString('zh-CN');
  return [
    `## ${index + 1}. ${a.title}`,
    `> ${a.source.name} · ${date}`,
    '',
    a.description || '',
    '',
    a.urlToImage ? `![图片](${a.urlToImage})` : '',
    '',
    `[阅读原文](${a.url})`,
    '---',
    '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function exportMarkdown(articles: NewsArticle[], query: string): string {
  const header = [
    `# 搜索结果: "${query}"`,
    `导出时间: ${new Date().toLocaleString('zh-CN')}`,
    `共 ${articles.length} 条结果`,
    '',
    '---',
    '',
  ].join('\n');

  const body = articles.map((a, i) => articleToMarkdown(a, i)).join('\n');
  return header + body;
}

export function exportJSON(articles: NewsArticle[], query: string): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      query,
      totalResults: articles.length,
      articles,
    },
    null,
    2
  );
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportCSV(articles: NewsArticle[]): string {
  const header = ['标题', '来源', '作者', '发布时间', '摘要', '链接', '图片'];
  const rows = articles.map((a) =>
    [
      escapeCSV(a.title),
      escapeCSV(a.source.name),
      escapeCSV(a.author || ''),
      a.publishedAt,
      escapeCSV(a.description || ''),
      a.url,
      a.urlToImage || '',
    ].join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
