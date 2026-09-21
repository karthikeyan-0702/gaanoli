import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-6 text-center bg-rose-950/20 border border-rose-900/50 rounded-lg max-w-md mx-auto my-6',
        className
      )}
    >
      <div className="flex items-center justify-center w-10 h-10 mb-3 rounded-full bg-rose-900/30 text-rose-400">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-rose-200">{title}</h3>
      <p className="mt-1 text-xs text-rose-300/80 max-w-xs">{message}</p>
      {onRetry && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            className="border-rose-800/80 text-rose-200 hover:bg-rose-900/30"
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
