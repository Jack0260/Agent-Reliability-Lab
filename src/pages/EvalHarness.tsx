import { useState, useMemo } from 'react';
import {
  ClipboardCheck, Play, Loader2, CheckCircle2, XCircle, TrendingUp,
  AlertTriangle, Zap, Clock, DollarSign, Target, ArrowRight,
} from 'lucide-react';
import type { AppStore } from '@/hooks/useAppStore';
import type { EvalResult, BenchmarkCategory } from '@/types';
import { MODEL_CONFIGS } from '@/data/tools';
import { BENCHMARK_TASKS } from '@/data/benchmarks';
import { CategoryBadge, StatusBadge } from '@/components/Badges';
import { CATEGORY_LABELS, formatLatency, formatTokens } from '@/lib/ui';
import { computeAggregateMetrics, detectRegressions } from '@/lib/evalScoring';

type EvalPhase = 'idle' | 'running' | 'done';

export function EvalHarness({ store }: { store: AppStore }) {
  const { evalResults } = store;
  const [phase, setPhase] = useState<EvalPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [selectedConfig, setSelectedConfig] = useState(MODEL_CONFIGS[1].id);

  const runEvaluation = async () => {
    setPhase('running');
    setProgress(0);
    for (let i = 0; i <= 100; i += 5) {
      setProgress(i);
      await new Promise((r) => setTimeout(r, 40));
    }
    setPhase('done');
  };

  const configResults = useMemo(() => {
    return evalResults.filter((r) => r.modelConfig === selectedConfig);
  }, [evalResults, selectedConfig]);

  const metrics = useMemo(() => computeAggregateMetrics(configResults), [configResults]);

  const regressionCheck = useMemo(() => {
    const configA = evalResults.filter((r) => r.modelConfig === MODEL_CONFIGS[0].id);
    const configB = evalResults.filter((r) => r.modelConfig === MODEL_CONFIGS[1].id);
    const metricsA = computeAggregateMetrics(configA);
    const metricsB = computeAggregateMetrics(configB);
    return detectRegressions(metricsA, metricsB);
  }, [evalResults]);

  const byCategory = useMemo(() => {
    const categories: BenchmarkCategory[] = ['single_tool', 'multi_tool', 'retry_required', 'missing_data', 'ambiguous_request', 'blocked_unsafe', 'budget_exhaustion'];
    return categories.map((cat) => {
      const results = configResults.filter((r) => r.category === cat);
      const passed = results.filter((r) => r.passed).length;
      const avgScore = results.length > 0 ? results.reduce((a, r) => a + r.overallScore, 0) / results.length : 0;
      return {
        category: cat,
        total: results.length,
        passed,
        avgScore: Math.round(avgScore * 100),
      };
    });
  }, [configResults]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Control bar */}
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Model Configuration</label>
            <select value={selectedConfig} onChange={(e) => setSelectedConfig(e.target.value)} className="input w-auto">
              {MODEL_CONFIGS.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {phase !== 'running' ? (
            <button onClick={runEvaluation} className="btn-primary">
              <Play className="h-4 w-4" /> Run Evaluation ({BENCHMARK_TASKS.length} tasks)
            </button>
          ) : (
            <button disabled className="btn-primary">
              <Loader2 className="h-4 w-4 animate-spin" /> Running...
            </button>
          )}
        </div>
        {phase === 'running' && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>Running benchmark suite...</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Aggregate Metrics */}
      {phase !== 'idle' && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <EvalMetric label="Success Rate" value={`${Math.round(metrics.successRate * 100)}%`} icon={<CheckCircle2 className="h-4 w-4" />} accent="success" />
            <EvalMetric label="Tool Accuracy" value={`${Math.round(metrics.toolAccuracy * 100)}%`} icon={<Target className="h-4 w-4" />} accent="primary" />
            <EvalMetric label="Avg Score" value={`${Math.round(metrics.taskCompletion * 100)}%`} icon={<TrendingUp className="h-4 w-4" />} accent="info" />
            <EvalMetric label="Avg Latency" value={formatLatency(metrics.avgLatency)} icon={<Clock className="h-4 w-4" />} accent="warning" />
            <EvalMetric label="Avg Tokens" value={formatTokens(metrics.avgTokens)} icon={<Zap className="h-4 w-4" />} accent="accent" />
            <EvalMetric label="Violations" value={metrics.policyViolations} icon={<AlertTriangle className="h-4 w-4" />} accent="error" />
          </div>

          {/* Regression Detection */}
          <div className="card p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <AlertTriangle className="h-4 w-4 text-warning-500" /> Regression Detection
              <span className="text-xs font-normal text-slate-400">— Agent v1 vs v2</span>
            </h3>
            <div className="space-y-2">
              {regressionCheck.map((rc, i) => (
                <div key={i} className={`flex items-center justify-between rounded-lg border p-3 ${
                  rc.isRegression
                    ? 'border-error-300 bg-error-50/50 dark:border-error-800 dark:bg-error-950/20'
                    : 'border-slate-200 dark:border-slate-700'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      rc.isRegression ? 'bg-error-100 text-error-600 dark:bg-error-900/30 dark:text-error-400' : 'bg-success-100 text-success-600 dark:bg-success-900/30 dark:text-success-400'
                    }`}>
                      {rc.isRegression ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{rc.metric}</p>
                      <p className="text-[10px] text-slate-400">
                        {typeof rc.oldValue === 'number' && rc.oldValue < 1 ? `${Math.round(rc.oldValue * 100)}%` : rc.oldValue}
                        <ArrowRight className="mx-1 inline h-2.5 w-2.5" />
                        {typeof rc.newValue === 'number' && rc.newValue < 1 ? `${Math.round(rc.newValue * 100)}%` : rc.newValue}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold ${rc.isRegression ? 'text-error-600 dark:text-error-400' : 'text-success-600 dark:text-success-400'}`}>
                    {rc.isRegression ? 'REGRESSED' : 'OK'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* By Category */}
          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Results by Category</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {byCategory.map((c) => (
                <div key={c.category} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <CategoryBadge category={c.category} size="xs" />
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">{c.passed}</span>
                    <span className="text-sm text-slate-400">/ {c.total}</span>
                    <span className="ml-auto text-xs font-medium text-slate-500">{c.avgScore}% avg</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${c.total > 0 ? (c.passed / c.total) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Results Table */}
          <div className="card overflow-hidden">
            <h3 className="border-b border-slate-200 px-5 py-4 text-sm font-semibold text-slate-900 dark:text-white dark:border-slate-800">
              Detailed Task Results
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Task</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Category</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">Score</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">Tools</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">Args</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">Ground</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">Latency</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">Retries</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">Status</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">Pass</th>
                  </tr>
                </thead>
                <tbody>
                  {configResults.slice(0, 20).map((r) => (
                    <tr key={r.taskId} className="border-b border-slate-100 dark:border-slate-800/50">
                      <td className="px-4 py-2 max-w-[200px] truncate text-xs text-slate-700 dark:text-slate-300">{r.taskPrompt}</td>
                      <td className="px-4 py-2"><span className="text-[10px] text-slate-500">{CATEGORY_LABELS[r.category]}</span></td>
                      <td className="px-4 py-2 text-center font-mono text-xs font-bold text-slate-900 dark:text-white">{Math.round(r.overallScore * 100)}</td>
                      <td className="px-4 py-2 text-center font-mono text-xs text-slate-600 dark:text-slate-400">{Math.round(r.toolSelectionAccuracy * 100)}%</td>
                      <td className="px-4 py-2 text-center font-mono text-xs text-slate-600 dark:text-slate-400">{Math.round(r.argumentValidity * 100)}%</td>
                      <td className="px-4 py-2 text-center font-mono text-xs text-slate-600 dark:text-slate-400">{Math.round(r.groundedness * 100)}%</td>
                      <td className="px-4 py-2 text-center font-mono text-xs text-slate-600 dark:text-slate-400">{formatLatency(r.latencyMs)}</td>
                      <td className="px-4 py-2 text-center font-mono text-xs text-slate-600 dark:text-slate-400">{r.retries}</td>
                      <td className="px-4 py-2 text-center"><StatusBadge status={r.status} size="xs" /></td>
                      <td className="px-4 py-2 text-center">
                        {r.passed ? <CheckCircle2 className="mx-auto h-4 w-4 text-success-500" /> : <XCircle className="mx-auto h-4 w-4 text-error-400" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {phase === 'idle' && (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <ClipboardCheck className="mb-3 h-12 w-12 text-slate-300 dark:text-slate-700" />
          <p className="text-sm text-slate-500">Click "Run Evaluation" to score all {BENCHMARK_TASKS.length} benchmark tasks.</p>
        </div>
      )}
    </div>
  );
}

function EvalMetric({ label, value, icon, accent }: { label: string; value: string | number; icon: React.ReactNode; accent: string }) {
  const colors: Record<string, string> = {
    success: 'text-success-600 dark:text-success-400',
    primary: 'text-primary-600 dark:text-primary-400',
    info: 'text-info-600 dark:text-info-400',
    warning: 'text-warning-600 dark:text-warning-400',
    accent: 'text-accent-600 dark:text-accent-400',
    error: 'text-error-600 dark:text-error-400',
  };
  return (
    <div className="card p-4">
      <div className={`mb-2 ${colors[accent]}`}>{icon}</div>
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
