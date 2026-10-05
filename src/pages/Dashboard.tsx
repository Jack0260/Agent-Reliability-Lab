import { useMemo } from 'react';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend,
  RadialBarChart, RadialBar,
} from 'recharts';
import {
  CheckCircle2, AlertTriangle, Clock, DollarSign, Zap, ShieldAlert, Activity, Target,
} from 'lucide-react';
import type { AppStore } from '@/hooks/useAppStore';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/Badges';
import { useTheme } from '@/context/ThemeContext';
import { getChartColors, STATUS_LABELS, formatCost, formatLatency, formatTokens } from '@/lib/ui';
import type { RunStatus, BenchmarkCategory } from '@/types';
import { CATEGORY_LABELS } from '@/lib/ui';
import { TOOLS, MODEL_CONFIGS } from '@/data/tools';
import { computeAggregateMetrics } from '@/lib/evalScoring';

export function Dashboard({ store }: { store: AppStore }) {
  const { theme } = useTheme();
  const colors = getChartColors(theme === 'dark');
  const { runs, evalResults } = store;

  const metrics = useMemo(() => {
    const successful = runs.filter((r) => r.status === 'succeeded' || r.status === 'partially_succeeded').length;
    const successRate = runs.length > 0 ? successful / runs.length : 0;
    const avgLatency = runs.length > 0 ? Math.round(runs.reduce((a, r) => a + r.totalDurationMs, 0) / runs.length) : 0;
    const sortedLatency = [...runs].sort((a, b) => a.totalDurationMs - b.totalDurationMs);
    const p95Idx = Math.floor(sortedLatency.length * 0.95);
    const p95Latency = sortedLatency[Math.min(p95Idx, sortedLatency.length - 1)]?.totalDurationMs ?? 0;
    const avgCost = runs.length > 0 ? runs.reduce((a, r) => a + r.totalCost, 0) / runs.length : 0;
    const avgTokens = runs.length > 0 ? Math.round(runs.reduce((a, r) => a + r.totalTokens, 0) / runs.length) : 0;
    const policyViolations = runs.filter((r) => r.status === 'blocked_by_policy').length;
    const successfulRuns = runs.filter((r) => r.status === 'succeeded');
    const avgCostPerSuccess = successfulRuns.length > 0
      ? successfulRuns.reduce((a, r) => a + r.totalCost, 0) / successfulRuns.length
      : 0;

    return { successRate, avgLatency, p95Latency, avgCost, avgTokens, policyViolations, avgCostPerSuccess, total: runs.length };
  }, [runs]);

  const statusData = useMemo(() => {
    const counts: Record<RunStatus, number> = {
      succeeded: 0, partially_succeeded: 0, failed: 0, budget_exhausted: 0, blocked_by_policy: 0,
    };
    runs.forEach((r) => { counts[r.status]++; });
    return Object.entries(counts).map(([key, value]) => ({
      name: STATUS_LABELS[key as RunStatus],
      value,
      status: key as RunStatus,
    })).filter((d) => d.value > 0);
  }, [runs]);

  const statusColorMap: Record<string, string> = {
    succeeded: colors.success,
    partially_succeeded: colors.warning,
    failed: colors.error,
    budget_exhausted: colors.accent,
    blocked_by_policy: '#dc2626',
  };

  const categoryData = useMemo(() => {
    const categories: BenchmarkCategory[] = ['single_tool', 'multi_tool', 'retry_required', 'missing_data', 'ambiguous_request', 'blocked_unsafe', 'budget_exhaustion'];
    return categories.map((cat) => {
      const catResults = evalResults.filter((r) => r.category === cat);
      const passed = catResults.filter((r) => r.passed).length;
      return {
        name: CATEGORY_LABELS[cat].replace(' ', '\n'),
        passed,
        total: catResults.length,
        rate: catResults.length > 0 ? Math.round((passed / catResults.length) * 100) : 0,
      };
    });
  }, [evalResults]);

  const tokenTrendData = useMemo(() => {
    return [...runs].reverse().slice(-15).map((r) => ({
      name: r.id.slice(-4),
      tokens: r.totalTokens,
      cost: Math.round(r.totalCost * 10000) / 10000,
    }));
  }, [runs]);

  const toolCostData = useMemo(() => {
    const toolCosts: Record<string, { cost: number; calls: number }> = {};
    runs.forEach((r) => {
      r.steps.forEach((s) => {
        if (s.stepType === 'tool_call' && s.toolName) {
          const tool = TOOLS.find((t) => t.name === s.toolName);
          if (tool) {
            if (!toolCosts[tool.displayName]) toolCosts[tool.displayName] = { cost: 0, calls: 0 };
            toolCosts[tool.displayName].cost += s.estimatedCost;
            toolCosts[tool.displayName].calls += 1;
          }
        }
      });
    });
    return Object.entries(toolCosts)
      .map(([name, data]) => ({ name, cost: Math.round(data.cost * 10000) / 10000, calls: data.calls }))
      .sort((a, b) => b.cost - a.cost);
  }, [runs]);

  const failureCategories = useMemo(() => {
    const cats: Record<string, number> = {};
    runs.filter((r) => r.status !== 'succeeded').forEach((r) => {
      const key = STATUS_LABELS[r.status];
      cats[key] = (cats[key] || 0) + 1;
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [runs]);

  const configComparison = useMemo(() => {
    return MODEL_CONFIGS.map((config) => {
      const configResults = evalResults.filter((r) => r.modelConfig === config.id);
      const agg = computeAggregateMetrics(configResults);
      return {
        name: config.name,
        successRate: Math.round(agg.successRate * 100),
        toolAccuracy: Math.round(agg.toolAccuracy * 100),
        avgCost: Math.round(agg.avgCost),
        config,
      };
    });
  }, [evalResults]);

  const policyViolationData = useMemo(() => {
    const blocked = runs.filter((r) => r.status === 'blocked_by_policy');
    return blocked.slice(0, 10).map((r) => ({
      name: r.id.slice(-4),
      violations: r.steps.filter((s) => s.policyDecision === 'blocked' || s.policyDecision === 'requires_approval').length,
    }));
  }, [runs]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Overall Success Rate"
          value={`${Math.round(metrics.successRate * 100)}%`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="success"
          trend={`${runs.filter(r => r.status === 'succeeded').length}/${runs.length} runs`}
          trendUp={metrics.successRate > 0.5}
        />
        <StatCard
          label="Avg Latency"
          value={formatLatency(metrics.avgLatency)}
          icon={<Clock className="h-5 w-5" />}
          accent="info"
          trend={`p95: ${formatLatency(metrics.p95Latency)}`}
          trendUp={false}
        />
        <StatCard
          label="Avg Cost / Successful Task"
          value={formatCost(metrics.avgCostPerSuccess)}
          icon={<DollarSign className="h-5 w-5" />}
          accent="accent"
          trend={`${formatCost(metrics.avgCost)} avg all runs`}
          trendUp={false}
        />
        <StatCard
          label="Policy Violations"
          value={metrics.policyViolations}
          icon={<ShieldAlert className="h-5 w-5" />}
          accent="error"
          trend={`${runs.length} total runs tracked`}
          trendUp={metrics.policyViolations === 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Avg Tokens / Run"
          value={formatTokens(metrics.avgTokens)}
          icon={<Zap className="h-5 w-5" />}
          accent="primary"
        />
        <StatCard
          label="Total Runs"
          value={metrics.total}
          icon={<Activity className="h-5 w-5" />}
          accent="info"
        />
        <StatCard
          label="Tool Accuracy"
          value={`${Math.round(computeAggregateMetrics(evalResults).toolAccuracy * 100)}%`}
          icon={<Target className="h-5 w-5" />}
          accent="success"
        />
        <StatCard
          label="Task Completion"
          value={`${Math.round(computeAggregateMetrics(evalResults).taskCompletion * 100)}%`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="primary"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Success Rate Donut */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Run Outcomes</h3>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Distribution of run statuses</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
              >
                {statusData.map((entry, idx) => (
                  <Cell key={idx} fill={statusColorMap[entry.status]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: colors.tooltipBg,
                  border: `1px solid ${colors.tooltipBorder}`,
                  borderRadius: '8px',
                  color: colors.tooltipText,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1.5">
            {statusData.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusColorMap[d.status] }} />
                  <span className="text-slate-600 dark:text-slate-400">{d.name}</span>
                </div>
                <span className="font-semibold text-slate-900 dark:text-white">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Task Completion by Category */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Task Completion by Category</h3>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Pass rate across benchmark categories</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              <XAxis dataKey="name" tick={{ fill: colors.axis, fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fill: colors.axis, fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: colors.tooltipBg,
                  border: `1px solid ${colors.tooltipBorder}`,
                  borderRadius: '8px',
                  color: colors.tooltipText,
                }}
              />
              <Bar dataKey="passed" fill={colors.primary} radius={[4, 4, 0, 0]} name="Passed" />
              <Bar dataKey="total" fill={colors.slate} radius={[4, 4, 0, 0]} name="Total" opacity={0.3} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Token Usage Trend */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Token Usage Trend</h3>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Token consumption across recent runs</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={tokenTrendData}>
              <defs>
                <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.primary} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              <XAxis dataKey="name" tick={{ fill: colors.axis, fontSize: 10 }} />
              <YAxis tick={{ fill: colors.axis, fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: colors.tooltipBg,
                  border: `1px solid ${colors.tooltipBorder}`,
                  borderRadius: '8px',
                  color: colors.tooltipText,
                }}
              />
              <Area type="monotone" dataKey="tokens" stroke={colors.primary} fill="url(#tokenGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Failure Categories */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Failure Categories</h3>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Non-success run breakdown</p>
          {failureCategories.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={failureCategories} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} horizontal={false} />
                <XAxis type="number" tick={{ fill: colors.axis, fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: colors.axis, fontSize: 10 }} width={100} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: colors.tooltipBg,
                    border: `1px solid ${colors.tooltipBorder}`,
                    borderRadius: '8px',
                    color: colors.tooltipText,
                  }}
                />
                <Bar dataKey="value" fill={colors.error} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-slate-400">
              No failures detected
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Most Expensive Tools */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Most Expensive Tools</h3>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">By total estimated cost</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={toolCostData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} horizontal={false} />
              <XAxis type="number" tick={{ fill: colors.axis, fontSize: 10 }} tickFormatter={(v) => `$${v.toFixed(3)}`} />
              <YAxis type="category" dataKey="name" tick={{ fill: colors.axis, fontSize: 9 }} width={110} />
              <Tooltip
                contentStyle={{
                  backgroundColor: colors.tooltipBg,
                  border: `1px solid ${colors.tooltipBorder}`,
                  borderRadius: '8px',
                  color: colors.tooltipText,
                }}
                formatter={(v) => `${Number(v).toFixed(4)}`}
              />
              <Bar dataKey="cost" fill={colors.accent} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Policy Violations */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Policy Violations</h3>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Blocked actions by run</p>
          {policyViolationData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={policyViolationData}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="name" tick={{ fill: colors.axis, fontSize: 10 }} />
                <YAxis tick={{ fill: colors.axis, fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: colors.tooltipBg,
                    border: `1px solid ${colors.tooltipBorder}`,
                    borderRadius: '8px',
                    color: colors.tooltipText,
                  }}
                />
                <Bar dataKey="violations" fill={colors.error} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-slate-400">
              No policy violations
            </div>
          )}
        </div>

        {/* Config Comparison */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Version Comparison</h3>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Agent v1 vs v2 key metrics</p>
          <div className="space-y-4">
            {configComparison.map((c) => (
              <div key={c.name}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{c.name}</span>
                  <span className="text-xs font-bold" style={{ color: c.config.color }}>
                    {c.successRate}% success
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div>
                    <div className="mb-0.5 flex justify-between text-[10px] text-slate-500">
                      <span>Tool Accuracy</span>
                      <span>{c.toolAccuracy}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div className="h-full rounded-full" style={{ width: `${c.toolAccuracy}%`, backgroundColor: c.config.color }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-0.5 flex justify-between text-[10px] text-slate-500">
                      <span>Success Rate</span>
                      <span>{c.successRate}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div className="h-full rounded-full" style={{ width: `${c.successRate}%`, backgroundColor: c.config.color }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Runs Table */}
      <div className="card p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Recent Agent Runs</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="pb-2 text-left text-xs font-medium text-slate-500">Run ID</th>
                <th className="pb-2 text-left text-xs font-medium text-slate-500">Request</th>
                <th className="pb-2 text-left text-xs font-medium text-slate-500">Status</th>
                <th className="pb-2 text-right text-xs font-medium text-slate-500">Cost</th>
                <th className="pb-2 text-right text-xs font-medium text-slate-500">Tokens</th>
                <th className="pb-2 text-right text-xs font-medium text-slate-500">Latency</th>
              </tr>
            </thead>
            <tbody>
              {runs.slice(0, 8).map((run) => (
                <tr key={run.id} className="border-b border-slate-100 dark:border-slate-800/50">
                  <td className="py-2.5 font-mono text-xs text-slate-600 dark:text-slate-400">{run.id}</td>
                  <td className="py-2.5 max-w-xs truncate text-slate-700 dark:text-slate-300">{run.userRequest}</td>
                  <td className="py-2.5"><StatusBadge status={run.status} size="xs" /></td>
                  <td className="py-2.5 text-right font-mono text-xs text-slate-600 dark:text-slate-400">{formatCost(run.totalCost)}</td>
                  <td className="py-2.5 text-right font-mono text-xs text-slate-600 dark:text-slate-400">{formatTokens(run.totalTokens)}</td>
                  <td className="py-2.5 text-right font-mono text-xs text-slate-600 dark:text-slate-400">{formatLatency(run.totalDurationMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
