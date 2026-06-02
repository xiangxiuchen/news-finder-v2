'use client';

import type { AISummary } from '@/types';

interface AISummaryPanelProps {
  summary: AISummary;
  onClose: () => void;
}

export default function AISummaryPanel({ summary, onClose }: AISummaryPanelProps) {
  return (
    <div className="mt-3 bg-gradient-to-br from-purple-50 to-white border border-purple-100 rounded-xl p-4 text-sm animate-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center">
            <svg className="w-3 h-3 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </span>
          <span className="font-semibold text-purple-900 text-xs">AI 选题提炼</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Summary */}
      <div className="mb-3">
        <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">📋 核心事实摘要</h4>
        <p className="text-xs text-gray-700 leading-relaxed">{summary.summary}</p>
      </div>

      {/* Hot Analysis */}
      {summary.hotAnalysis && (
        <div className="mb-3">
          <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">🔥 舆论爆点分析</h4>
          <p className="text-xs text-gray-700 leading-relaxed">{summary.hotAnalysis}</p>
        </div>
      )}

      {/* Post Suggestions */}
      {summary.postSuggestions.length > 0 && (
        <div>
          <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">💡 发帖切入点建议</h4>
          <ul className="space-y-1.5">
            {summary.postSuggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
