import { Skeleton } from '@/components/ui/skeleton';

export default function ResultsSkeleton() {
  return (
    <div className="space-y-8">
      {/* Stats hero cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-700/30 bg-slate-800/30 p-5 text-center space-y-2">
            <Skeleton className="h-10 w-20 mx-auto" />
            <Skeleton className="h-4 w-28 mx-auto" />
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-slate-700/30 bg-slate-800/30 p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-5 w-20" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Winners list */}
      <div className="space-y-4">
        <Skeleton className="h-7 w-40" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>

      {/* Losses grid */}
      <div className="space-y-4">
        <Skeleton className="h-5 w-32" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
