import React from 'react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center bg-gt-elevated/40 border border-dashed border-gt-border rounded-lg max-w-lg mx-auto my-8',
        className
      )}
    >
      {icon && (
        <div className="flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-gt-surface border border-gt-border text-gt-text-secondary">
          {icon}
        </div>
      )}
      <h3 className="text-base font-medium text-gt-text">{title}</h3>
      <p className="mt-1.5 text-xs text-gt-text-secondary max-w-sm leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <div className="mt-5">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
