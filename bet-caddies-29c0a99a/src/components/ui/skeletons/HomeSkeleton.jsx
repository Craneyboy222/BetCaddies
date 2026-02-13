import { Skeleton } from '@/components/ui/skeleton';

export default function HomeSkeleton() {
  return (
    <div className="space-y-10">
      {/* Category cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-700/30 bg-slate-800/30 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-9 w-12" />
            </div>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>

      {/* Featured picks header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-5 w-20" />
      </div>

      {/* Featured bet cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-700/30 bg-slate-800/30 p-5 space-y-4">
            <div className="flex justify-between">
              <Skeleton className="h-7 w-28 rounded-full" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-7 w-56" />
            <div className="flex justify-between items-center">
              <Skeleton className="h-8 w-20 rounded" />
              <Skeleton className="h-10 w-24" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
