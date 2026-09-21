import React from 'react';
import { cn } from '../../lib/utils';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ items, activeId, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex items-center space-x-1 border-b border-gt-border', className)}>
      {items.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors duration-150',
              isActive
                ? 'border-brand-500 text-brand-400 font-semibold'
                : 'border-transparent text-gt-text-secondary hover:text-gt-text hover:border-gt-border'
            )}
          >
            {tab.icon && <span className="inline-flex">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  'px-1.5 py-0.2 rounded-full text-[10px] font-mono',
                  isActive
                    ? 'bg-brand-950 text-brand-300 border border-brand-800'
                    : 'bg-gt-surface text-gt-text-secondary border border-gt-border'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
