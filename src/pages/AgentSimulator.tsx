import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Square, Loader2, Send, Terminal, Clock, Zap, DollarSign,
  ChevronRight, AlertTriangle, CheckCircle2, XCircle, RotateCw,
  MessageCircleQuestion, FileWarning, Shield, Brain,
} from 'lucide-react';
import type { AppStore } from '@/hooks/useAppStore';
import type { AgentRun, TraceStep, PolicyProfile } from '@/types';
import { simulateAgentRun } from '@/lib/agentSimulator';
import { POLICY_PROFILES, MODEL_CONFIGS, TOOLS } from '@/data/tools';
import { StatusBadge, PolicyBadge } from '@/components/Badges';
import { STATUS_LABELS, formatCost, formatTokens, formatLatency, RECOVERY_LABELS } from '@/lib/ui';

const PRESET_PROMPTS = [
  'Search the incident knowledge base for past incidents related to "payment-gateway-timeout".',
  'Check the health of the nightly ETL pipeline.',
  'Investigate checkout API errors: check pipeline health, query analytics, and search the KB.',
  'Something is wrong with the data. Can you look into it?',
  'Execute "rm -rf /var/lib/postgresql/data" on the production database server.',
  'Search KB for every incident in the last year and create a detailed report for each.',
  'Query analytics for all metrics across all services for the past 30 days.',
];

type SimPhase = 'idle' | 'running' | 'done';

export function AgentSimulator({ store }: { store: AppStore }) {
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<SimPhase>('idle');
  const [visibleSteps, setVisibleSteps] = useState<TraceStep[]>([]);
  const [finalRun, setFinalRun] = useState<AgentRun | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState(store.activeProfileId);
  const [selectedConfigId, setSelectedConfigId] = useState(MODEL_CONFIGS[1].id);
  const [liveTokens, setLiveTokens] = useState(0);
  const [liveCost, setLiveCost] = useState(0);
  const cancelRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const profile = POLICY_PROFILES.find((p) => p.id === selectedProfileId)!;
  const config = MODEL_CONFIGS.find((c) => c.id === selectedConfigId)!;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleSteps]);

  const runSimulation = useCallback(async () => {
    if (!input.trim()) return;
    cancelRef.current = false;
    setPhase('running');
    setVisibleSteps([]);
    setFinalRun(null);
    setLiveTokens(0);
    setLiveCost(0);

    const { run, steps } = simulateAgentRun(input, profile, config.id, config.name, config.promptStrategy);

    // Reveal steps one by one with delay for the "live" effect
    for (let i = 0; i < steps.length; i++) {
      if (cancelRef.current) break;
      setVisibleSteps((prev) => [...prev, steps[i]]);
      setLiveTokens(steps[i].cumulativeTokens);
      setLiveCost(steps[i].cumulativeCost);
      // Vary delay by step type for realism
      const delay = steps[i].stepType === 'tool_call' ? 400 : steps[i].stepType === 'tool_result' ? 200 : 150;
      await new Promise((r) => setTimeout(r, delay));
    }

    if (!cancelRef.current) {
      setFinalRun(run);
      store.addRun(run);
      setPhase('done');
    }
  }, [input, profile, config, store]);

  const cancelRun = () => {
    cancelRef.current = true;
    setPhase('idle');
  };

  const reset = () => {
    setPhase('idle');
    setVisibleSteps([]);
    setFinalRun(null);
    setLiveTokens(0);
    setLiveCost(0);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Controls Bar */}
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[300px]">
            <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Agent Request
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && phase === 'idle') runSimulation(); }}
                placeholder="Enter a request for the Data Operations Agent..."
                className="input"
                disabled={phase === 'running'}
              />
              {phase === 'idle' || phase === 'done' ? (
                <button onClick={runSimulation} disabled={!input.trim()} className="btn-primary whitespace-nowrap">
                  <Play className="h-4 w-4" /> Run Agent
                </button>
              ) : (
                <button onClick={cancelRun} className="btn bg-error-600 text-white hover:bg-error-700">
                  <Square className="h-4 w-4" /> Stop
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Policy Profile
            </label>
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="input w-auto"
              disabled={phase === 'running'}
            >
              {POLICY_PROFILES.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Model Config
            </label>
            <select
              value={selectedConfigId}
              onChange={(e) => setSelectedConfigId(e.target.value)}
              className="input w-auto"
              disabled={phase === 'running'}
            >
              {MODEL_CONFIGS.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Preset prompts */}
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESET_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => { setInput(p); reset(); }}
              disabled={phase === 'running'}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 transition-all hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-primary-700 dark:hover:bg-primary-950/30"
            >
              {p.length > 50 ? p.slice(0, 50) + '...' : p}
            </button>
          ))}
        </div>
      </div>

      {/* Live Metrics Bar */}
      {(phase === 'running' || phase === 'done') && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricPill icon={<Zap className="h-4 w-4" />} label="Tokens" value={formatTokens(liveTokens)} color="primary" />
          <MetricPill icon={<DollarSign className="h-4 w-4" />} label="Cost" value={formatCost(liveCost)} color="accent" />
          <MetricPill icon={<Terminal className="h-4 w-4" />} label="Steps" value={visibleSteps.length} color="info" />
          <MetricPill
            icon={phase === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            label="Status"
            value={phase === 'running' ? 'Running...' : STATUS_LABELS[finalRun?.status ?? 'succeeded']}
            color={finalRun?.status === 'succeeded' ? 'success' : finalRun ? 'warning' : 'info'}
          />
        </div>
      )}

      {/* Policy Info */}
      <PolicyInfoBar profile={profile} />

      {/* Trace Timeline */}
      {(visibleSteps.length > 0 || phase === 'idle') && (
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Live Trace Timeline</h3>
            {phase === 'done' && (
              <button onClick={reset} className="btn-ghost text-xs">
                <RotateCw className="h-3.5 w-3.5" /> Reset
              </button>
            )}
          </div>

          <div ref={scrollRef} className="max-h-[600px] space-y-3 overflow-y-auto pr-2">
            {visibleSteps.length === 0 && phase === 'idle' && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Terminal className="mb-3 h-12 w-12 text-slate-300 dark:text-slate-700" />
                <p className="text-sm text-slate-400">Enter a request and click "Run Agent" to see a live trace.</p>
              </div>
            )}

            {visibleSteps.map((step, idx) => (
              <StepCard key={step.id} step={step} isLast={idx === visibleSteps.length - 1} />
            ))}

            {phase === 'running' && (
              <div className="flex items-center gap-2 py-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Agent is thinking...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Final Result */}
      {finalRun && phase === 'done' && (
        <div className="card animate-slide-up p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Run Result</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{finalRun.statusReason}</p>
            </div>
            <StatusBadge status={finalRun.status} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-slate-500">Total Tokens</p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{formatTokens(finalRun.totalTokens)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Cost</p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{formatCost(finalRun.totalCost)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Duration</p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{formatLatency(finalRun.totalDurationMs)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricPill({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary-50 text-primary-700 dark:bg-primary-950/30 dark:text-primary-400',
    accent: 'bg-accent-50 text-accent-700 dark:bg-accent-950/30 dark:text-accent-400',
    info: 'bg-info-50 text-info-700 dark:bg-info-950/30 dark:text-info-400',
    success: 'bg-success-50 text-success-700 dark:bg-success-950/30 dark:text-success-400',
    warning: 'bg-warning-50 text-warning-700 dark:bg-warning-950/30 dark:text-warning-400',
  };
  return (
    <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 ${colorMap[color]}`}>
      {icon}
      <div>
        <p className="text-[10px] font-medium opacity-70">{label}</p>
        <p className="text-sm font-bold">{value}</p>
      </div>
    </div>
  );
}

function PolicyInfoBar({ profile }: { profile: PolicyProfile }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary-600 dark:text-primary-400" />
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{profile.name}</span>
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        Budget: <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{profile.maxTokenBudget} tokens</span>
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        Max Calls: <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{profile.maxToolCalls}</span>
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        Max Retries: <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{profile.maxRetries}</span>
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        Allowed Tools: <span className="font-medium text-slate-700 dark:text-slate-300">{profile.toolAllowlist.length}</span>
      </div>
    </div>
  );
}

const STEP_ICONS: Record<TraceStep['stepType'], React.ReactNode> = {
  plan: <Brain className="h-4 w-4" />,
  tool_call: <Terminal className="h-4 w-4" />,
  tool_result: <ChevronRight className="h-4 w-4" />,
  policy_check: <Shield className="h-4 w-4" />,
  reasoning: <Brain className="h-4 w-4" />,
  final: <CheckCircle2 className="h-4 w-4" />,
};

const STEP_COLORS: Record<TraceStep['stepType'], string> = {
  plan: 'bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-400',
  tool_call: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
  tool_result: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  policy_check: 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400',
  reasoning: 'bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-400',
  final: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400',
};

function StepCard({ step, isLast }: { step: TraceStep; isLast: boolean }) {
  const isFailed = step.isFailurePoint;
  const isBlocked = step.policyDecision === 'blocked' || step.policyDecision === 'requires_approval';

  return (
    <div className={`relative rounded-lg border p-4 animate-slide-in-right ${
      isFailed ? 'border-error-300 bg-error-50/50 dark:border-error-800 dark:bg-error-950/20'
      : isBlocked ? 'border-accent-300 bg-accent-50/50 dark:border-accent-800 dark:bg-accent-950/20'
      : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
    }`}>
      {/* Step number and type */}
      <div className="flex items-center gap-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${STEP_COLORS[step.stepType]}`}>
          {STEP_ICONS[step.stepType]}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-900 dark:text-white">
              Step {step.stepNumber}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-slate-400">
              {step.stepType.replace('_', ' ')}
            </span>
            {step.retryCount > 0 && (
              <span className="badge bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400 text-[10px]">
                <RotateCw className="h-2.5 w-2.5" /> Retry {step.retryCount}
              </span>
            )}
          </div>
        </div>
        <PolicyBadge decision={step.policyDecision} size="xs" />
      </div>

      {/* Agent belief */}
      <div className="mt-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Agent Belief: </span>
          {step.agentBelief}
        </p>
      </div>

      {/* Tool details */}
      {step.toolName && step.toolInputArgs && (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
            <p className="mb-1 text-[10px] font-medium text-slate-400">Tool Input</p>
            <pre className="overflow-x-auto text-xs text-slate-600 dark:text-slate-400">
              {JSON.stringify(step.toolInputArgs, null, 2)}
            </pre>
          </div>
          {step.toolOutputSummary && (
            <div className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
              <p className="mb-1 text-[10px] font-medium text-slate-400">Tool Output</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">{step.toolOutputSummary}</p>
            </div>
          )}
        </div>
      )}

      {/* Policy reason */}
      <div className="mt-2 flex items-start gap-2">
        <Shield className="mt-0.5 h-3 w-3 flex-shrink-0 text-slate-400" />
        <p className="text-[11px] text-slate-500 dark:text-slate-500">{step.policyReason}</p>
      </div>

      {/* Recovery strategy */}
      {step.recoveryStrategy !== 'none' && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-warning-50 p-2.5 dark:bg-warning-950/20">
          {step.recoveryStrategy === 'retry_with_backoff' && <RotateCw className="mt-0.5 h-3 w-3 flex-shrink-0 text-warning-600" />}
          {step.recoveryStrategy === 'ask_clarifying_question' && <MessageCircleQuestion className="mt-0.5 h-3 w-3 flex-shrink-0 text-warning-600" />}
          {step.recoveryStrategy === 'return_partial_result' && <FileWarning className="mt-0.5 h-3 w-3 flex-shrink-0 text-warning-600" />}
          {step.recoveryStrategy === 'refuse_and_log' && <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-error-600" />}
          <div>
            <p className="text-[11px] font-semibold text-warning-700 dark:text-warning-400">
              {RECOVERY_LABELS[step.recoveryStrategy]}
            </p>
            {step.recoveryExplanation && (
              <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">{step.recoveryExplanation}</p>
            )}
            {step.betterRecoveryStrategy && (
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">
                <span className="font-medium">Better strategy: </span>{step.betterRecoveryStrategy}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Metrics footer */}
      <div className="mt-2 flex items-center gap-4 text-[10px] text-slate-400">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatLatency(step.latencyMs)}</span>
        <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> {formatTokens(step.tokenUsage)} tokens</span>
        <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> {formatCost(step.estimatedCost)}</span>
        <span className="ml-auto font-mono">cum: {formatTokens(step.cumulativeTokens)} / {formatCost(step.cumulativeCost)}</span>
      </div>
    </div>
  );
}
