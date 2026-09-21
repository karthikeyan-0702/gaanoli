import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gt-bg disabled:pointer-events-none disabled:opacity-50 select-none';

    const variants = {
      primary: 'bg-brand-600 hover:bg-brand-500 text-gt-text active:bg-brand-700',
      secondary:
        'bg-gt-elevated hover:bg-gt-hover text-gt-text border border-gt-border active:bg-gt-active',
      outline:
        'border border-gt-border text-gt-text-secondary hover:bg-gt-hover hover:text-gt-text active:bg-gt-active',
      ghost: 'text-gt-text-secondary hover:bg-gt-hover hover:text-gt-text active:bg-gt-active',
      danger: 'bg-red-600 hover:bg-red-500 text-gt-text active:bg-red-700'
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
      md: 'h-9 px-4 text-sm rounded-lg gap-2',
      lg: 'h-11 px-5 text-sm rounded-lg gap-2',
      icon: 'h-9 w-9 p-0 rounded-lg'
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-current" />}
        {!isLoading && leftIcon && <span className="inline-flex items-center">{leftIcon}</span>}
        {children}
        {!isLoading && rightIcon && <span className="inline-flex items-center">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
