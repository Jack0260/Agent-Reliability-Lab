import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export function StatCard({
  label,
  value,
  unit,
  icon,
  trend,
  trendUp,
  accent = 'primary',
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  trend?: string;
  trendUp?: boolean;
  accent?: 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info';
}) {
  const accentColors: Record<string, string> = {
    primary: 'bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400',
    accent: 'bg-accent-50 text-accent-600 dark:bg-accent-950/40 dark:text-accent-400',
    success: 'bg-success-50 text-success-600 dark:bg-success-950/40 dark:text-success-400',
    warning: 'bg-warning-50 text-warning-600 dark:bg-warning-950/40 dark:text-warning-400',
    error: 'bg-error-50 text-error-600 dark:bg-error-950/40 dark:text-error-400',
    info: 'bg-info-50 text-info-600 dark:bg-info-950/40 dark:text-info-400',
  };

  return (
    <div className="card card-hover p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {value}
            {unit && <span className="ml-1 text-sm font-normal text-slate-400">{unit}</span>}
          </p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accentColors[accent]}`}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1.5">
          {trendUp !== undefined && (
            trendUp
              ? <TrendingUp className="h-3.5 w-3.5 text-success-500" />
              : <TrendingDown className="h-3.5 w-3.5 text-error-500" />
          )}
          <span className={`text-xs font-medium ${trendUp ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'}`}>
            {trend}
          </span>
        </div>
      )}
    </div>
  );
}
