'use client';

import type { TimeFilter, SortBy } from '@/types';

interface FilterBarProps {
  time: TimeFilter;
  sortBy: SortBy;
  onTimeChange: (t: TimeFilter) => void;
  onSortChange: (s: SortBy) => void;
}

const TIME_OPTIONS: { value: TimeFilter; label: string }[] = [
  { value: '24h', label: '24小时内' },
  { value: '3d', label: '近3天' },
  { value: '1w', label: '近1周' },
  { value: 'all', label: '近1月' },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'publishedAt', label: '最新' },
  { value: 'popularity', label: '最热' },
  { value: 'relevancy', label: '最相关' },
];

export default function FilterBar({ time, sortBy, onTimeChange, onSortChange }: FilterBarProps) {
  return (
    <div className="px-4 py-2.5 max-w-2xl mx-auto flex items-center justify-between gap-3 overflow-x-auto">
      {/* Time Filter */}
      <div className="flex items-center gap-1 shrink-0">
        {TIME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onTimeChange(opt.value)}
            className={`px-2.5 py-1 text-xs rounded-md transition-all whitespace-nowrap ${
              time === opt.value
                ? 'bg-gray-200 text-gray-900 font-medium'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Sort By */}
      <div className="flex items-center gap-1 shrink-0">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSortChange(opt.value)}
            className={`px-2.5 py-1 text-xs rounded-md transition-all whitespace-nowrap ${
              sortBy === opt.value
                ? 'bg-gray-200 text-gray-900 font-medium'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
