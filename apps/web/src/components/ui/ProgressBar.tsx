import { cn } from '../../lib/utils';

export interface ProgressBarProps {
  value: number; // 0 to 100
  max?: number;
  showLabel?: boolean;
  className?: string;
  barClassName?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressBar({
  value,
  max = 100,
  showLabel = false,
  className,
  barClassName,
  size = 'md'
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3'
  };

  return (
    <div className={cn('w-full space-y-1', className)}>
      <div className={cn('w-full bg-gt-surface border border-gt-border rounded-full overflow-hidden', sizeClasses[size])}>
        <div
          className={cn(
            'bg-brand-600 h-full rounded-full transition-all duration-300 ease-out',
            barClassName
          )}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between text-[11px] text-gt-text-secondary font-mono">
          <span>Progress</span>
          <span>{percentage}%</span>
        </div>
      )}
    </div>
  );
}
