import { Skeleton } from '@/components/ui/skeleton';

export default function BetGridSkeleton({ count = 6 }) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-700/30 bg-slate-800/30 p-5 space-y-4">
          {/* Market badge + confidence */}
          <div className="flex justify-between">
            <div className="flex gap-2">
              <Skeleton className="h-7 w-28 rounded-full" />
              <Skeleton className="h-7 w-14 rounded-full" />
            </div>
            <Skeleton className="h-5 w-24" />
          </div>
          {/* Tournament + player */}
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-7 w-56" />
          {/* Provider + odds */}
          <div className="flex justify-between items-center">
            <Skeleton className="h-8 w-20 rounded" />
            <Skeleton className="h-10 w-24" />
          </div>
          {/* Signal boxes */}
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
          {/* Action buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-700/50">
            <Skeleton className="h-10 flex-1 rounded" />
            <Skeleton className="h-10 flex-1 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
