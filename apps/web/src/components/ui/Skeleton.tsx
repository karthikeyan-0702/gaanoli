import { cn } from '../../lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded bg-gt-surface border border-gt-border', className)}
      {...props}
    />
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="bg-gt-elevated border border-gt-border rounded-md overflow-hidden shadow-card">
      <Skeleton className="w-full aspect-video rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex justify-between items-center pt-2">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-3 w-1/5" />
        </div>
      </div>
    </div>
  );
}
