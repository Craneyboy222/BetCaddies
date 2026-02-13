import { Skeleton } from '@/components/ui/skeleton';

export default function LiveTrackingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Event selector buttons */}
      <div className="flex flex-wrap gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-56 rounded-lg" />
        ))}
      </div>

      {/* Table container */}
      <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-40" />
        </div>
        {/* Table header */}
        <Skeleton className="h-10 w-full rounded" />
        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded" />
        ))}
      </div>
    </div>
  );
}
