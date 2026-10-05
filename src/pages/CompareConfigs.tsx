import { useMemo } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import { GitCompare, Trophy, Minus, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { AppStore } from '@/hooks/useAppStore';
import { MODEL_CONFIGS } from '@/data/tools';
import { useTheme } from '@/context/ThemeContext';
import { getChartColors, formatLatency, formatTokens } from '@/lib/ui';
import { computeAggregateMetrics, detectRegressions } from '@/lib/evalScoring';

export function CompareConfigs({ store }: { store: AppStore }) {
  const { evalResults } = store;
  const { theme } = useTheme();
  const colors = getChartColors(theme === 'dark');

  const comparison = useMemo(() => {
    const resultsA = evalResults.filter((r) => r.modelConfig === MODEL_CONFIGS[0].id);
    const resultsB = evalResults.filter((r) => r.modelConfig === MODEL_CONFIGS[1].id);
    const metricsA = computeAggregateMetrics(resultsA);
    const metricsB = computeAggregateMetrics(resultsB);
    const regressions = detectRegressions(metricsA, metricsB);

    const scoreA = metricsA.successRate * 0.3 + metricsA.toolAccuracy * 0.25 + metricsA.taskCompletion * 0.25 + (1 - Math.min(1, metricsA.avgCost / 20000)) * 0.1 + (1 - Math.min(1, metricsA.policyViolations / 10)) * 0.1;
    const scoreB = metricsB.successRate * 0.3 + metricsB.toolAccuracy * 0.25 + metricsB.taskCompletion * 0.25 + (1 - Math.min(1, metricsB.avgCost / 20000)) * 0.1 + (1 - Math.min(1, metricsB.policyViolations / 10)) * 0.1;
    const winner: 'A' | 'B' | 'tie' = Math.abs(scoreA - scoreB) < 0.02 ? 'tie' : scoreA > scoreB ? 'A' : 'B';

    return { resultsA, resultsB, metricsA, metricsB, regressions, winner, scoreA, scoreB };
  }, [evalResults]);

  const radarData = useMemo(() => {
    const m = comparison.metricsA;
    const m2 = comparison.metricsB;
    return [
      { metric: 'Success', A: Math.round(m.successRate * 100), B: Math.round(m2.successRate * 100) },
      { metric: 'Tool Acc.', A: Math.round(m.toolAccuracy * 100), B: Math.round(m2.toolAccuracy * 100) },
      { metric: 'Task Comp.', A: Math.round(m.taskCompletion * 100), B: Math.round(m2.taskCompletion * 100) },
      { metric: 'Arg Valid.', A: Math.round(m.argumentValidity * 100), B: Math.round(m2.argumentValidity * 100) },
      { metric: 'Grounded.', A: Math.round(m.groundedness * 100), B: Math.round(m2.groundedness * 100) },
      { metric: 'Cost Eff.', A: Math.round((1 - Math.min(1, m.avgCost / 20000)) * 100), B: Math.round((1 - Math.min(1, m2.avgCost / 20000)) * 100) },
    ];
  }, [comparison]);

  const configA = MODEL_CONFIGS[0];
  const configB = MODEL_CONFIGS[1];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Verdict banner */}
      <div className="card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
            <GitCompare className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Configuration Comparison</h3>
            <p className="text-xs text-slate-500">{configA.name} vs {configB.name}</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50">
            {comparison.winner === 'tie' ? (
              <>
                <Minus className="h-5 w-5 text-slate-400" />
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Tie</span>
              </>
            ) : (
              <>
                <Trophy className="h-5 w-5 text-accent-500" />
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {comparison.winner === 'A' ? configA.name : configB.name} wins
                </span>
              </>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Comparison based on {comparison.resultsA.length} and {comparison.resultsB.length} evaluation results.
          Overall score: {configA.name} = {Math.round(comparison.scoreA * 100)}, {configB.name} = {Math.round(comparison.scoreB * 100)}.
        </p>
      </div>

      {/* Side by side metrics */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ConfigPanel config={configA} metrics={comparison.metricsA} isWinner={comparison.winner === 'A'} />
        <ConfigPanel config={configB} metrics={comparison.metricsB} isWinner={comparison.winner === 'B'} />
      </div>

      {/* Radar chart */}
      <div className="card p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Multi-Dimensional Comparison</h3>
        <ResponsiveContainer width="100%" height={350}>
          <RadarChart data={radarData}>
            <PolarGrid stroke={colors.grid} />
            <PolarAngleAxis dataKey="metric" tick={{ fill: colors.axis, fontSize: 11 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={{ fill: colors.axis, fontSize: 9 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: colors.tooltipBg,
                border: `1px solid ${colors.tooltipBorder}`,
                borderRadius: '8px',
                color: colors.tooltipText,
              }}
            />
            <Radar name={configA.name} dataKey="A" stroke={configA.color} fill={configA.color} fillOpacity={0.3} strokeWidth={2} />
            <Radar name={configB.name} dataKey="B" stroke={configB.color} fill={configB.color} fillOpacity={0.3} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
        <div className="mt-3 flex justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: configA.color }} />
            <span className="text-xs text-slate-600 dark:text-slate-400">{configA.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: configB.color }} />
            <span className="text-xs text-slate-600 dark:text-slate-400">{configB.name}</span>
          </div>
        </div>
      </div>

      {/* Regression table */}
      <div className="card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <AlertTriangle className="h-4 w-4 text-warning-500" /> Regression Analysis
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Metric</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">{configA.name}</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">{configB.name}</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-500">Threshold</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {comparison.regressions.map((rc, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-800/50">
                  <td className="px-3 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300">{rc.metric}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-600 dark:text-slate-400">
                    {typeof rc.oldValue === 'number' && rc.oldValue < 1 ? `${Math.round(rc.oldValue * 100)}%` : rc.oldValue}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-600 dark:text-slate-400">
                    {typeof rc.newValue === 'number' && rc.newValue < 1 ? `${Math.round(rc.newValue * 100)}%` : rc.newValue}
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono text-xs text-slate-400">
                    {typeof rc.threshold === 'number' && rc.threshold < 1 ? `${Math.round(rc.threshold * 100)}%` : rc.threshold}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {rc.isRegression
                      ? <span className="badge bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400 text-[10px]">Regressed</span>
                      : <span className="badge bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400 text-[10px]">OK</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ConfigPanel({
  config, metrics, isWinner,
}: {
  config: typeof MODEL_CONFIGS[0]; metrics: ReturnType<typeof computeAggregateMetrics>; isWinner: boolean;
}) {
  const rows = [
    { label: 'Success Rate', value: `${Math.round(metrics.successRate * 100)}%` },
    { label: 'Tool Accuracy', value: `${Math.round(metrics.toolAccuracy * 100)}%` },
    { label: 'Task Completion', value: `${Math.round(metrics.taskCompletion * 100)}%` },
    { label: 'Avg Latency', value: formatLatency(metrics.avgLatency) },
    { label: 'p95 Latency', value: formatLatency(metrics.p95Latency) },
    { label: 'Avg Tokens', value: formatTokens(metrics.avgTokens) },
    { label: 'Policy Violations', value: metrics.policyViolations },
    { label: 'Avg Retries', value: metrics.avgRetries },
  ];

  return (
    <div className={`card p-5 ${isWinner ? 'ring-2 ring-accent-400' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full" style={{ backgroundColor: config.color }} />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{config.name}</h3>
        </div>
        {isWinner && <Trophy className="h-5 w-5 text-accent-500" />}
      </div>
      <p className="mt-1 text-xs text-slate-500">{config.description}</p>
      <div className="mt-4 space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800/50">
            <span className="text-xs text-slate-500">{r.label}</span>
            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
