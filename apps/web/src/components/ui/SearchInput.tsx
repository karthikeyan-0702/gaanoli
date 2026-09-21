import React, { forwardRef, useEffect, useRef, useImperativeHandle } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  showShortcut?: boolean;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onChange, onClear, showShortcut = true, placeholder = 'Search videos, channels...', ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        // Focus search when pressing '/' or 'Ctrl+K' / 'Cmd+K' while not already in an input
        if (
          (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) &&
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA'
        ) {
          e.preventDefault();
          inputRef.current?.focus();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleClear = () => {
      onChange('');
      onClear?.();
      inputRef.current?.focus();
    };

    return (
      <div className="relative flex items-center w-full">
        <div className="absolute left-3 flex items-center pointer-events-none text-gt-text-secondary">
          <Search className="h-4 w-4" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'w-full h-9 pl-9 pr-16 text-sm bg-[#212121] border border-[#2a2a2a] text-[#f1f1f1] placeholder-[#717171] rounded-full transition-colors',
            'focus:border-[#a855f7] focus:ring-1 focus:ring-[#a855f7] focus:outline-none',
            className
          )}
          {...props}
        />
        <div className="absolute right-2.5 flex items-center gap-1.5">
          {value ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded text-gt-text-secondary hover:text-gt-text hover:bg-gt-hover"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : showShortcut ? (
            <kbd className="hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-medium text-gt-text-secondary bg-gt-surface border border-gt-border rounded">
              /
            </kbd>
          ) : null}
        </div>
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
