import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'brand' | 'neutral' | 'success' | 'warning' | 'danger';
}

export function Badge({ className, variant = 'neutral', children, ...props }: BadgeProps) {
  const variants = {
    brand: 'bg-brand-950 text-brand-300 border border-brand-800',
    neutral: 'bg-gt-surface text-gt-text-secondary border border-gt-border',
    success: 'bg-emerald-950 text-emerald-300 border border-emerald-800',
    warning: 'bg-amber-950 text-amber-300 border border-amber-800',
    danger: 'bg-rose-950 text-rose-300 border border-rose-800'
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium tracking-wide',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
