import { useState, useMemo } from 'react';
import {
  Shield, ShieldCheck, AlertTriangle, Lock, Eye, Zap, Clock, FileWarning,
  CheckCircle2, XCircle, RotateCw, ScrollText,
} from 'lucide-react';
import type { AppStore } from '@/hooks/useAppStore';
import type { PolicyProfile, ToolName } from '@/types';
import { POLICY_PROFILES, TOOLS } from '@/data/tools';
import { PolicyBadge } from '@/components/Badges';
import { formatTimeAgo } from '@/lib/ui';

export function PolicyEngine({ store }: { store: AppStore }) {
  const { runs, activeProfileId, setActiveProfileId } = store;
  const [editingProfile, setEditingProfile] = useState<PolicyProfile>(
    POLICY_PROFILES.find((p) => p.id === activeProfileId) ?? POLICY_PROFILES[1]
  );

  const policyDecisions = useMemo(() => {
    const decisions: Array<{
      runId: string;
      request: string;
      stepNumber: number;
      decision: string;
      reason: string;
      timestamp: string;
      toolName?: string;
    }> = [];
    runs.forEach((run) => {
      run.steps.forEach((step) => {
        if (step.policyDecision !== 'allowed') {
          decisions.push({
            runId: run.id,
            request: run.userRequest,
            stepNumber: step.stepNumber,
            decision: step.policyDecision,
            reason: step.policyReason,
            timestamp: step.timestamp,
            toolName: step.toolDisplayName,
          });
        }
      });
    });
    return decisions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 15);
  }, [runs]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Profile selector */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          {POLICY_PROFILES.map((p) => (
            <button
              key={p.id}
              onClick={() => { setEditingProfile(p); setActiveProfileId(p.id); }}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                editingProfile.id === p.id
                  ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-500 dark:bg-primary-950/30 dark:text-primary-400'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
              }`}
            >
              <Shield className="mr-1.5 inline h-3.5 w-3.5" />
              {p.name}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{editingProfile.description}</p>
      </div>

      {/* Policy settings */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Budget & Limits */}
        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Zap className="h-4 w-4 text-primary-500" /> Budget & Limits
          </h3>
          <div className="space-y-4">
            <PolicySlider
              icon={<Zap className="h-4 w-4" />}
              label="Max Token Budget"
              value={editingProfile.maxTokenBudget}
              min={1000}
              max={32000}
              step={1000}
              unit="tokens"
              description="Maximum tokens consumed per agent run. Exceeding this triggers partial result return."
            />
            <PolicySlider
              icon={<Clock className="h-4 w-4" />}
              label="Max Tool Calls"
              value={editingProfile.maxToolCalls}
              min={1}
              max={30}
              step={1}
              unit="calls"
              description="Maximum number of tool invocations per run."
            />
            <PolicySlider
              icon={<RotateCw className="h-4 w-4" />}
              label="Max Retries"
              value={editingProfile.maxRetries}
              min={0}
              max={10}
              step={1}
              unit="retries"
              description="Maximum retry attempts per tool call with exponential backoff."
            />
          </div>
        </div>

        {/* Safety toggles */}
        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <ShieldCheck className="h-4 w-4 text-success-500" /> Safety Controls
          </h3>
          <div className="space-y-3">
            <PolicyToggle
              icon={<Eye className="h-4 w-4" />}
              label="Read-Only Tools Only"
              description="Restrict agent to only read-only tools. No drafts or writes."
              enabled={editingProfile.readOnlyOnly}
            />
            <PolicyToggle
              icon={<Lock className="h-4 w-4" />}
              label="Sensitive Data Redaction"
              description="Redact sensitive data (API keys, passwords, PII) from tool outputs."
              enabled={editingProfile.redactSensitiveData}
            />
            <PolicyToggle
              icon={<FileWarning className="h-4 w-4" />}
              label="Dry-Run for Destructive Ops"
              description="Require a dry-run simulation before any destructive operation."
              enabled={editingProfile.dryRunForDestructive}
            />
            <PolicyToggle
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Human Approval for Privileged Actions"
              description="Require human operator approval before privileged production actions."
              enabled={editingProfile.humanApprovalForPrivileged}
            />
          </div>
        </div>
      </div>

      {/* Tool Allowlist */}
      <div className="card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <Lock className="h-4 w-4 text-accent-500" /> Tool Allowlist
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => {
            const allowed = editingProfile.toolAllowlist.includes(tool.name);
            return (
              <div
                key={tool.name}
                className={`rounded-lg border p-3 transition-all ${
                  allowed
                    ? 'border-success-300 bg-success-50/50 dark:border-success-800 dark:bg-success-950/10'
                    : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">{tool.displayName}</span>
                  {allowed ? (
                    <CheckCircle2 className="h-4 w-4 text-success-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-slate-400" />
                  )}
                </div>
                <p className="mt-1 text-[10px] text-slate-500">{tool.description}</p>
                <div className="mt-2 flex gap-1.5">
                  {tool.isReadOnly && <span className="badge bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-400 text-[10px]">Read-Only</span>}
                  {tool.isDestructive && <span className="badge bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400 text-[10px]">Destructive</span>}
                  {tool.requiresApproval && <span className="badge bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400 text-[10px]">Needs Approval</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Policy Decision Log */}
      <div className="card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <ScrollText className="h-4 w-4 text-slate-500" /> Policy Decision Log
        </h3>
        <div className="space-y-2">
          {policyDecisions.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">No policy violations in recent runs.</p>
          ) : (
            policyDecisions.map((d, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400">{d.runId}</span>
                    {d.toolName && <span className="text-xs text-slate-500">— {d.toolName}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">{formatTimeAgo(d.timestamp)}</span>
                    <span className={`badge text-[10px] ${
                      d.decision === 'blocked' ? 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400'
                      : d.decision === 'requires_approval' ? 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400'
                      : 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400'
                    }`}>
                      {d.decision.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">{d.reason}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PolicySlider({
  icon, label, value, min, max, step, unit, description,
}: {
  icon: React.ReactNode; label: string; value: number; min: number; max: number; step: number; unit: string; description: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">{icon}</span>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
        </div>
        <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">{value} {unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        readOnly
        className="h-2 w-full cursor-default appearance-none rounded-full bg-slate-200 dark:bg-slate-700"
        style={{ accentColor: '#14b8a6' }}
      />
      <p className="mt-1 text-[10px] text-slate-400">{description}</p>
    </div>
  );
}

function PolicyToggle({
  icon, label, description, enabled,
}: {
  icon: React.ReactNode; label: string; description: string; enabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-slate-400">{icon}</span>
        <div>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</p>
          <p className="mt-0.5 text-[10px] text-slate-400">{description}</p>
        </div>
      </div>
      <div className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-success-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </div>
    </div>
  );
}
