import type { RunStatus, PolicyDecision, BenchmarkCategory, RecoveryStrategy } from '@/types';

export const STATUS_LABELS: Record<RunStatus, string> = {
  succeeded: 'Succeeded',
  partially_succeeded: 'Partially Succeeded',
  failed: 'Failed',
  budget_exhausted: 'Budget Exhausted',
  blocked_by_policy: 'Blocked by Policy',
};

export const STATUS_COLORS: Record<RunStatus, string> = {
  succeeded: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400',
  partially_succeeded: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400',
  failed: 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400',
  budget_exhausted: 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400',
  blocked_by_policy: 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400',
};

export const STATUS_DOT_COLORS: Record<RunStatus, string> = {
  succeeded: 'bg-success-500',
  partially_succeeded: 'bg-warning-500',
  failed: 'bg-error-500',
  budget_exhausted: 'bg-accent-500',
  blocked_by_policy: 'bg-error-600',
};

export const POLICY_LABELS: Record<PolicyDecision, string> = {
  allowed: 'Allowed',
  blocked: 'Blocked',
  dry_run_required: 'Dry-Run Required',
  requires_approval: 'Requires Approval',
};

export const POLICY_COLORS: Record<PolicyDecision, string> = {
  allowed: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400',
  blocked: 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400',
  dry_run_required: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400',
  requires_approval: 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400',
};

export const CATEGORY_LABELS: Record<BenchmarkCategory, string> = {
  single_tool: 'Single Tool',
  multi_tool: 'Multi-Tool',
  retry_required: 'Retry Required',
  missing_data: 'Missing Data',
  ambiguous_request: 'Ambiguous Request',
  blocked_unsafe: 'Blocked Unsafe',
  budget_exhaustion: 'Budget Exhaustion',
};

export const CATEGORY_COLORS: Record<BenchmarkCategory, string> = {
  single_tool: 'bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-400',
  multi_tool: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
  retry_required: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400',
  missing_data: 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400',
  ambiguous_request: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  blocked_unsafe: 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400',
  budget_exhaustion: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
};

export const RECOVERY_LABELS: Record<RecoveryStrategy, string> = {
  retry_with_backoff: 'Retry with Backoff',
  ask_clarifying_question: 'Ask Clarifying Question',
  return_partial_result: 'Return Partial Result',
  refuse_and_log: 'Refuse and Log',
  none: 'None',
};

export function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 10000) return `${(tokens / 1000).toFixed(1)}k`;
  return `${Math.round(tokens / 1000)}k`;
}

export function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  const minutes = Math.floor(diff / 60000);
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export function getChartColors(isDark: boolean) {
  return {
    primary: isDark ? '#2dd4bf' : '#0d9488',
    accent: isDark ? '#fbbf24' : '#d97706',
    success: isDark ? '#4ade80' : '#16a34a',
    warning: isDark ? '#fb923c' : '#ea580c',
    error: isDark ? '#f87171' : '#dc2626',
    info: isDark ? '#60a5fa' : '#2563eb',
    purple: isDark ? '#c084fc' : '#9333ea',
    slate: isDark ? '#94a3b8' : '#64748b',
    grid: isDark ? '#1e293b' : '#e2e8f0',
    axis: isDark ? '#64748b' : '#94a3b8',
    tooltipBg: isDark ? '#1e293b' : '#ffffff',
    tooltipBorder: isDark ? '#334155' : '#e2e8f0',
    tooltipText: isDark ? '#f1f5f9' : '#1e293b',
  };
}
