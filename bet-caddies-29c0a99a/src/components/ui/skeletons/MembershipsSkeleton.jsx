import { Skeleton } from '@/components/ui/skeleton';

export default function MembershipsSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12 space-y-4">
        <Skeleton className="h-16 w-16 rounded-2xl mx-auto" />
        <Skeleton className="h-10 w-72 mx-auto" />
        <Skeleton className="h-6 w-96 mx-auto" />
      </div>

      {/* Billing toggle */}
      <div className="flex justify-center mb-8">
        <Skeleton className="h-12 w-64 rounded-xl" />
      </div>

      {/* Pricing cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-700/30 bg-slate-800/30 p-8 space-y-6">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-8 w-40" />
            <div className="space-y-1">
              <Skeleton className="h-12 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-4 w-full" />
            <div className="space-y-3">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
            <Skeleton className="h-11 w-full rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
