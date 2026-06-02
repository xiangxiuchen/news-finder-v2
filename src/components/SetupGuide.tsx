export default function SetupGuide() {
  return (
    <div className="px-4 py-12 max-w-lg mx-auto">
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </span>
          <span className="text-sm font-semibold text-amber-900">需要配置 API 密钥</span>
        </div>

        <p className="text-xs text-amber-800 leading-relaxed mb-4">
          NewsFinder 需要 NewsAPI 密钥来获取新闻数据。可选配 AI 密钥（DeepSeek 或 Claude）来启用语义搜索、选题提炼与翻译功能。
        </p>

        <div className="space-y-2">
          <div className="bg-white/60 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-gray-700">1. 获取密钥</span>
            </div>
            <ul className="text-[11px] text-gray-500 space-y-0.5 ml-1">
              <li>• NewsAPI: <span className="text-gray-400">newsapi.org/register</span></li>
              <li>• AI (DeepSeek): <span className="text-gray-400">platform.deepseek.com/api_keys</span></li>
              <li>• 或 AI (Claude): <span className="text-gray-400">console.anthropic.com</span></li>
            </ul>
          </div>

          <div className="bg-white/60 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-gray-700">2. 配置环境变量</span>
            </div>
            <p className="text-[11px] text-gray-500">编辑项目根目录的 <code className="text-amber-700 bg-amber-50 px-1 rounded text-[10px]">.env.local</code> 文件</p>
          </div>

          <div className="bg-white/60 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-gray-700">3. 重启 dev server</span>
            </div>
            <p className="text-[11px] text-gray-500">
              修改后需要重新运行 <code className="text-amber-700 bg-amber-50 px-1 rounded text-[10px]">npm run dev</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
