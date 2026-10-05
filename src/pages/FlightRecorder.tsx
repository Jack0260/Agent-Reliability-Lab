import { useState, useEffect, useCallback } from 'react';
import {
  Play, Pause, ChevronLeft, ChevronRight, SkipBack, SkipForward,
  Brain, Terminal, Shield, AlertTriangle, Clock, Zap, DollarSign,
  Search, Filter, RotateCw, MessageCircleQuestion, FileWarning, XCircle,
} from 'lucide-react';
import type { AppStore } from '@/hooks/useAppStore';
import type { AgentRun, TraceStep, RunStatus } from '@/types';
import { StatusBadge, PolicyBadge } from '@/components/Badges';
import { STATUS_LABELS, STATUS_COLORS, formatCost, formatTokens, formatLatency, formatTimeAgo, RECOVERY_LABELS } from '@/lib/ui';

const STATUS_FILTERS: (RunStatus | 'all')[] = ['all', 'succeeded', 'partially_succeeded', 'failed', 'budget_exhausted', 'blocked_by_policy'];

export function FlightRecorder({ store }: { store: AppStore }) {
  const { runs } = store;
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [filter, setFilter] = useState<RunStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const filteredRuns = runs.filter((r) => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (search && !r.userRequest.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null;

  if (selectedRun) {
    return <RunReplay run={selectedRun} onBack={() => setSelectedRunId(null)} />;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search runs by request..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-9"
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-slate-400" />
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  filter === f
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                {f === 'all' ? 'All' : STATUS_LABELS[f]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Run ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Request</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Steps</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Cost</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Latency</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">When</th>
              </tr>
            </thead>
            <tbody>
              {filteredRuns.map((run) => (
                <tr
                  key={run.id}
                  onClick={() => setSelectedRunId(run.id)}
                  className="cursor-pointer border-b border-slate-100 transition-all hover:bg-slate-50 dark:border-slate-800/50 dark:hover:bg-slate-800/30"
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{run.id}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-slate-700 dark:text-slate-300">{run.userRequest}</td>
                  <td className="px-4 py-3"><StatusBadge status={run.status} size="xs" /></td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-600 dark:text-slate-400">{run.steps.length}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-600 dark:text-slate-400">{formatCost(run.totalCost)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-600 dark:text-slate-400">{formatLatency(run.totalDurationMs)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatTimeAgo(run.startTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredRuns.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-400">No runs match the current filter.</div>
        )}
      </div>
    </div>
  );
}

function RunReplay({ run, onBack }: { run: AgentRun; onBack: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, run.steps.length - 1));
  }, [run.steps.length]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    if (currentStep >= run.steps.length - 1) {
      setIsPlaying(false);
      return;
    }
    const timer = setTimeout(() => nextStep(), 1200);
    return () => clearTimeout(timer);
  }, [isPlaying, currentStep, run.steps.length, nextStep]);

  const step = run.steps[currentStep];
  const progress = ((currentStep + 1) / run.steps.length) * 100;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="card p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <button onClick={onBack} className="mb-2 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
              <ChevronLeft className="h-3.5 w-3.5" /> Back to run list
            </button>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{run.id}</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{run.userRequest}</p>
            <div className="mt-2 flex items-center gap-3">
              <StatusBadge status={run.status} size="xs" />
              <span className="text-xs text-slate-500">{run.promptStrategy}</span>
              <span className="text-xs text-slate-500">{formatTimeAgo(run.startTime)}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Total Cost / Tokens</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCost(run.totalCost)}</p>
            <p className="text-xs text-slate-400">{formatTokens(run.totalTokens)} tokens</p>
          </div>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentStep(0)} className="btn-ghost p-2" title="First step">
            <SkipBack className="h-4 w-4" />
          </button>
          <button onClick={prevStep} disabled={currentStep === 0} className="btn-ghost p-2" title="Previous">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white transition-all hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <button onClick={nextStep} disabled={currentStep === run.steps.length - 1} className="btn-ghost p-2" title="Next">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={() => setCurrentStep(run.steps.length - 1)} className="btn-ghost p-2" title="Last step">
            <SkipForward className="h-4 w-4" />
          </button>
          <div className="ml-2 flex-1">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>Step {currentStep + 1} of {run.steps.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className="h-full rounded-full bg-primary-500 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Live Cost/Token display */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat icon={<Zap className="h-4 w-4" />} label="Cum. Tokens" value={formatTokens(step.cumulativeTokens)} />
        <MiniStat icon={<DollarSign className="h-4 w-4" />} label="Cum. Cost" value={formatCost(step.cumulativeCost)} />
        <MiniStat icon={<Clock className="h-4 w-4" />} label="Step Latency" value={formatLatency(step.latencyMs)} />
        <MiniStat icon={<Terminal className="h-4 w-4" />} label="Retries" value={step.retryCount} />
      </div>

      {/* Step Detail */}
      <ReplayStepDetail step={step} />

      {/* Step List (clickable) */}
      <div className="card p-4">
        <h4 className="mb-3 text-xs font-semibold text-slate-500">All Steps</h4>
        <div className="flex flex-wrap gap-1.5">
          {run.steps.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { setCurrentStep(i); setIsPlaying(false); }}
              className={`flex h-7 w-7 items-center justify-center rounded text-[10px] font-mono font-medium transition-all ${
                i === currentStep
                  ? 'bg-primary-600 text-white'
                  : s.isFailurePoint
                  ? 'bg-error-100 text-error-700 hover:bg-error-200 dark:bg-error-900/30 dark:text-error-400'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
              }`}
              title={`Step ${s.stepNumber}: ${s.stepType}`}
            >
              {s.stepNumber}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="card flex items-center gap-2.5 px-4 py-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
        {icon}
      </div>
      <div>
        <p className="text-[10px] text-slate-500">{label}</p>
        <p className="text-sm font-bold text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function ReplayStepDetail({ step }: { step: TraceStep }) {
  return (
    <div className="space-y-4">
      {/* What the agent believed */}
      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-400">
            <Brain className="h-4 w-4" />
          </div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">What the Agent Believed</h4>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">{step.agentBelief}</p>
      </div>

      {/* Tool selection */}
      {step.toolName && (
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
              <Terminal className="h-4 w-4" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Tool Selected: {step.toolDisplayName}</h4>
          </div>
          {step.toolInputArgs && (
            <div className="mb-3">
              <p className="mb-1 text-xs font-medium text-slate-500">Input Arguments</p>
              <pre className="overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
                {JSON.stringify(step.toolInputArgs, null, 2)}
              </pre>
            </div>
          )}
          {step.toolOutputSummary && (
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Output Summary</p>
              <div className={`rounded-lg p-3 text-xs ${
                step.toolOutputSummary.includes('ERROR')
                  ? 'bg-error-50 text-error-700 dark:bg-error-950/20 dark:text-error-400'
                  : 'bg-slate-50 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300'
              }`}>
                {step.toolOutputSummary}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Policy decision */}
      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400">
            <Shield className="h-4 w-4" />
          </div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Policy Decision</h4>
          <PolicyBadge decision={step.policyDecision} size="xs" />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">{step.policyReason}</p>
      </div>

      {/* Failure + recovery */}
      {step.isFailurePoint && (
        <div className="card border-error-300 p-5 dark:border-error-800">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Where It Failed</h4>
          </div>
          {step.recoveryStrategy !== 'none' && (
            <div className="mb-3 rounded-lg bg-warning-50 p-3 dark:bg-warning-950/20">
              <p className="text-xs font-semibold text-warning-700 dark:text-warning-400">
                {RECOVERY_LABELS[step.recoveryStrategy]}
              </p>
              {step.recoveryExplanation && (
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{step.recoveryExplanation}</p>
              )}
            </div>
          )}
          {step.betterRecoveryStrategy && (
            <div className="rounded-lg bg-info-50 p-3 dark:bg-info-950/20">
              <p className="text-xs font-semibold text-info-700 dark:text-info-400">Better Recovery Strategy</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{step.betterRecoveryStrategy}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
