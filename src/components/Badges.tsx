import type { RunStatus, PolicyDecision, BenchmarkCategory } from '@/types';
import { STATUS_LABELS, STATUS_COLORS, POLICY_LABELS, POLICY_COLORS, CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/ui';

export function StatusBadge({ status, size = 'sm' }: { status: RunStatus; size?: 'sm' | 'xs' }) {
  return (
    <span className={`badge ${STATUS_COLORS[status]} ${size === 'xs' ? 'text-[10px] px-2 py-0.5' : ''}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PolicyBadge({ decision, size = 'sm' }: { decision: PolicyDecision; size?: 'sm' | 'xs' }) {
  return (
    <span className={`badge ${POLICY_COLORS[decision]} ${size === 'xs' ? 'text-[10px] px-2 py-0.5' : ''}`}>
      {POLICY_LABELS[decision]}
    </span>
  );
}

export function CategoryBadge({ category, size = 'sm' }: { category: BenchmarkCategory; size?: 'sm' | 'xs' }) {
  return (
    <span className={`badge ${CATEGORY_COLORS[category]} ${size === 'xs' ? 'text-[10px] px-2 py-0.5' : ''}`}>
      {CATEGORY_LABELS[category]}
    </span>
  );
}
