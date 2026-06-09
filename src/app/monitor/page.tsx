'use client';

import { useState, useEffect, useCallback } from 'react';
import NavBar from '@/components/NavBar';

const ALL_BRANDS = ['Litime', 'EcoWorthy', 'Redodo Power', 'Wattcycle', 'Renogy', 'Battle Born'];
const PRODUCTS = ['golf cart battery', 'lithium battery', 'marine battery', 'solar inverter', '48V battery'];

interface BrandData {
  brand: string;
  news: { title: string; url: string; source: string; date: string; isNew: boolean }[];
  reddit: { title: string; url: string; snippet: string }[];
  amazon: { title: string; price: string; isNew: boolean }[];
  website: { title: string; url: string }[];
  newCount: number;
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return '刚刚';
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

export default function MonitorPage() {
  const [data, setData] = useState<BrandData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBrand, setActiveBrand] = useState<string>('all');
  const [category, setCategory] = useState(PRODUCTS[0]);
  const [report, setReport] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/monitor?brands=${ALL_BRANDS.join(',')}&category=${encodeURIComponent(category)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setData(d.brands || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const generateReport = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/monitor?brands=${ALL_BRANDS.join(',')}&category=${encodeURIComponent(category)}&report=true`);
      const d = await res.json();
      setReport(d.aiSummary || '生成失败');
    } catch {
      setReport('生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const filtered = activeBrand === 'all' ? data : data.filter(b => b.brand === activeBrand);
  const totalNew = data.reduce((s, b) => s + b.newCount, 0);

  return (
    <div className="min-h-screen bg-white">
      <NavBar />
      <main className="max-w-2xl mx-auto pb-16">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-50">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-lg bg-gray-900 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <h1 className="text-base font-semibold text-gray-900">竞品监控</h1>
            {totalNew > 0 && (
              <span className="px-1.5 py-0.5 bg-red-50 text-red-500 text-[10px] font-medium rounded">{totalNew} 个新品信号</span>
            )}
          </div>
          <p className="text-[11px] text-gray-400">美国锂电池市场 · {category}</p>
        </div>

        {/* Product Category Selector */}
        <div className="px-4 py-2.5 border-b border-gray-50 flex gap-1 overflow-x-auto">
          {PRODUCTS.map(p => (
            <button key={p} onClick={() => setCategory(p)}
              className={`shrink-0 px-2.5 py-1 text-[11px] rounded-md transition-colors ${category === p ? 'bg-gray-900 text-white font-medium' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
            >{p}</button>
          ))}
        </div>

        {/* Brand Tabs */}
        <div className="px-4 py-2.5 border-b border-gray-50 flex gap-1 overflow-x-auto">
          <button onClick={() => setActiveBrand('all')}
            className={`shrink-0 px-2.5 py-1 text-[11px] rounded-md transition-colors ${activeBrand === 'all' ? 'bg-gray-200 text-gray-900 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
          >全部</button>
          {ALL_BRANDS.map(b => (
            <button key={b} onClick={() => setActiveBrand(b)}
              className={`shrink-0 px-2.5 py-1 text-[11px] rounded-md transition-colors ${activeBrand === b ? 'bg-gray-200 text-gray-900 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
            >{b}</button>
          ))}
        </div>

        {/* Loading / Error */}
        {loading && (
          <div className="px-4 py-12 text-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-gray-400">正在搜索各平台数据...</p>
          </div>
        )}
        {error && !loading && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-red-500">{error}</p>
            <button onClick={fetchData} className="mt-2 text-xs text-gray-500 underline">重试</button>
          </div>
        )}

        {/* AI Report */}
        {!loading && data.length > 0 && (
          <div className="px-4 pt-3 pb-1">
            <button onClick={generateReport} disabled={generating}
              className="w-full h-9 text-xs font-medium bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {generating ? (
                <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> AI 生成周报...</>
              ) : (
                <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg> AI 生成竞品周报</>
              )}
            </button>
            {report && (
              <div className="mt-2 p-3 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100 rounded-xl text-xs text-gray-700 leading-relaxed">
                {report}
              </div>
            )}
          </div>
        )}

        {/* Brand Cards */}
        {!loading && filtered.map((brand) => (
          <div key={brand.brand} className="px-4 pt-4">
            {/* Brand header */}
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-sm font-semibold text-gray-900">{brand.brand}</h2>
              {brand.newCount > 0 && (
                <span className="px-1.5 py-0.5 bg-red-50 text-red-500 text-[10px] font-medium rounded animate-pulse">🆕 {brand.newCount} 个新品信号</span>
              )}
            </div>

            {/* News */}
            {brand.news.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">📰 新闻</p>
                {brand.news.map((n, i) => (
                  <a key={i} href={n.url} target="_blank" className="flex items-start gap-2 py-1.5 group">
                    <span className="w-1 h-1 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                    <span className="text-xs text-gray-600 group-hover:text-gray-900 leading-relaxed">
                      {n.title}
                      {n.isNew && <span className="ml-1 text-[10px] text-red-500 font-medium">🆕</span>}
                    </span>
                  </a>
                ))}
              </div>
            )}

            {/* Reddit */}
            {brand.reddit.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">💬 Reddit 讨论</p>
                {brand.reddit.map((r, i) => (
                  <a key={i} href={r.url} target="_blank" className="flex items-start gap-2 py-1.5 group">
                    <span className="w-3.5 h-3.5 rounded-full bg-orange-50 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-2 h-2 text-orange-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>
                    </span>
                    <span className="text-xs text-gray-600 group-hover:text-gray-900">{r.title.slice(0, 100)}</span>
                  </a>
                ))}
              </div>
            )}

            {/* Amazon */}
            {brand.amazon.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">🛒 Amazon 产品</p>
                {brand.amazon.map((a, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-gray-600 flex-1 truncate mr-2">
                      {a.title}
                      {a.isNew && <span className="ml-1 text-[10px] text-red-500 font-medium">🆕</span>}
                    </span>
                    <span className="text-xs font-medium text-gray-900 shrink-0">{a.price}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Website */}
            {brand.website.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">🏢 官网公告</p>
                {brand.website.map((w, i) => (
                  <a key={i} href={w.url} target="_blank" className="flex items-start gap-2 py-1.5 group">
                    <span className="w-1 h-1 rounded-full bg-green-400 mt-1.5 shrink-0" />
                    <span className="text-xs text-gray-600 group-hover:text-gray-900">
                      {w.title}
                      <span className="ml-1 text-[10px] text-red-500 font-medium">🆕 新品</span>
                    </span>
                  </a>
                ))}
              </div>
            )}

            {brand.news.length === 0 && brand.reddit.length === 0 && brand.amazon.length === 0 && (
              <p className="text-xs text-gray-300 py-2">本周暂无新数据</p>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
