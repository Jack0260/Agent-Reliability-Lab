import { useState, useMemo } from 'react';
import { Search, ListChecks, Target, AlertTriangle, Zap, Clock, RotateCw, MessageCircleQuestion, Ban, DollarSign } from 'lucide-react';
import { BENCHMARK_TASKS } from '@/data/benchmarks';
import { CategoryBadge } from '@/components/Badges';
import { CATEGORY_LABELS } from '@/lib/ui';
import type { BenchmarkCategory } from '@/types';

const CATEGORY_ICONS: Record<BenchmarkCategory, React.ReactNode> = {
  single_tool: <Target className="h-4 w-4" />,
  multi_tool: <ListChecks className="h-4 w-4" />,
  retry_required: <RotateCw className="h-4 w-4" />,
  missing_data: <MessageCircleQuestion className="h-4 w-4" />,
  ambiguous_request: <AlertTriangle className="h-4 w-4" />,
  blocked_unsafe: <Ban className="h-4 w-4" />,
  budget_exhaustion: <DollarSign className="h-4 w-4" />,
};

const CATEGORIES: (BenchmarkCategory | 'all')[] = ['all', 'single_tool', 'multi_tool', 'retry_required', 'missing_data', 'ambiguous_request', 'blocked_unsafe', 'budget_exhaustion'];

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400',
  medium: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400',
  hard: 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400',
};

export function Benchmarks() {
  const [filter, setFilter] = useState<BenchmarkCategory | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return BENCHMARK_TASKS.filter((t) => {
      if (filter !== 'all' && t.category !== filter) return false;
      if (search && !t.prompt.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    BENCHMARK_TASKS.forEach((t) => { c[t.category] = (c[t.category] || 0) + 1; });
    return c;
  }, []);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Benchmark Library</h3>
            <p className="mt-0.5 text-xs text-slate-500">{BENCHMARK_TASKS.length} tasks across 7 categories</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
            <ListChecks className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Category summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {CATEGORIES.slice(1).map((cat) => (
          <div key={cat} className="card p-3 text-center">
            <div className="mb-1.5 flex justify-center text-slate-400">{CATEGORY_ICONS[cat as BenchmarkCategory]}</div>
            <p className="text-[10px] text-slate-500">{CATEGORY_LABELS[cat as BenchmarkCategory]}</p>
            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{counts[cat] || 0}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  filter === c
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                {c === 'all' ? 'All' : CATEGORY_LABELS[c as BenchmarkCategory]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Task grid */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {filtered.map((task) => (
          <div key={task.id} className="card card-hover p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-slate-400">{task.id}</span>
                  <CategoryBadge category={task.category} size="xs" />
                  <span className={`badge text-[10px] ${DIFFICULTY_COLORS[task.difficulty]}`}>{task.difficulty}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">{task.prompt}</p>
                <p className="mt-1 text-xs text-slate-500">{task.description}</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <div>
                <p className="text-[10px] font-medium text-slate-400">Expected Tools</p>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  {task.expectedTools.map((t) => t.replace(/_/g, ' ')).join(', ')}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-400">Expected Outcome</p>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  {task.expectedOutcome.replace(/_/g, ' ')}
                  {task.expectedRetries > 0 && ` (${task.expectedRetries} retries)`}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card py-12 text-center text-sm text-slate-400">No tasks match the current filter.</div>
      )}
    </div>
  );
}
