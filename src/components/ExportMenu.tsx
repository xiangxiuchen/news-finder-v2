import type { NewsArticle } from '@/types';
import { exportMarkdown, exportJSON, exportCSV, downloadFile } from '@/lib/export';

interface ExportMenuProps {
  articles: NewsArticle[];
  query: string;
}

export default function ExportMenu({ articles, query }: ExportMenuProps) {
  const handleExport = (format: 'markdown' | 'json' | 'csv') => {
    switch (format) {
      case 'markdown': {
        const content = exportMarkdown(articles, query);
        downloadFile(content, `news-export-${Date.now()}.md`, 'text/markdown;charset=utf-8');
        break;
      }
      case 'json': {
        const content = exportJSON(articles, query);
        downloadFile(content, `news-export-${Date.now()}.json`, 'application/json;charset=utf-8');
        break;
      }
      case 'csv': {
        const content = exportCSV(articles);
        downloadFile(content, `news-export-${Date.now()}.csv`, 'text/csv;charset=utf-8');
        break;
      }
    }
  };

  if (articles.length === 0) return null;

  return (
    <div className="px-4 py-3 flex items-center justify-end gap-1">
      <span className="text-[11px] text-gray-400 mr-auto">
        共 {articles.length} 条结果
      </span>
      {['markdown', 'json', 'csv'].map((fmt) => (
        <button
          key={fmt}
          onClick={() => handleExport(fmt as 'markdown' | 'json' | 'csv')}
          className="px-2.5 py-1 text-[11px] font-medium text-gray-500 bg-gray-50 hover:bg-gray-100
                     rounded-md transition-colors uppercase tracking-wider"
        >
          {fmt === 'markdown' ? 'MD' : fmt === 'json' ? 'JSON' : 'CSV'}
        </button>
      ))}
    </div>
  );
}
