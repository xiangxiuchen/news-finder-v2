export default function SkeletonCard() {
  return (
    <div className="px-4 py-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-20 h-20 rounded-lg bg-gray-100 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="h-4 bg-gray-100 rounded w-full mb-2" />
          <div className="h-4 bg-gray-100 rounded w-3/4 mb-3" />
          <div className="h-3 bg-gray-50 rounded w-1/3" />
        </div>
      </div>
      <div className="mt-3 h-px bg-gray-50" />
    </div>
  );
}
