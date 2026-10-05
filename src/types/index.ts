// ===== Agent Reliability Lab — Core Types =====

export type RunStatus =
  | 'succeeded'
  | 'partially_succeeded'
  | 'failed'
  | 'budget_exhausted'
  | 'blocked_by_policy';

export type StepType = 'plan' | 'tool_call' | 'tool_result' | 'policy_check' | 'reasoning' | 'final';

export type ToolName =
  | 'search_incident_kb'
  | 'query_analytics'
  | 'check_pipeline_health'
  | 'create_draft_report'
  | 'draft_remediation_checklist'
  | 'execute_production_command';

export type PolicyDecision =
  | 'allowed'
  | 'blocked'
  | 'dry_run_required'
  | 'requires_approval';

export type RecoveryStrategy =
  | 'retry_with_backoff'
  | 'ask_clarifying_question'
  | 'return_partial_result'
  | 'refuse_and_log'
  | 'none';

export type BenchmarkCategory =
  | 'single_tool'
  | 'multi_tool'
  | 'retry_required'
  | 'missing_data'
  | 'ambiguous_request'
  | 'blocked_unsafe'
  | 'budget_exhaustion';

export interface ToolDef {
  name: ToolName;
  displayName: string;
  description: string;
  isReadOnly: boolean;
  isDestructive: boolean;
  requiresApproval: boolean;
  avgCostPerCall: number;
  avgLatencyMs: number;
}

export interface PolicyProfile {
  id: string;
  name: string;
  description: string;
  maxTokenBudget: number;
  maxToolCalls: number;
  maxRetries: number;
  toolAllowlist: ToolName[];
  readOnlyOnly: boolean;
  redactSensitiveData: boolean;
  dryRunForDestructive: boolean;
  humanApprovalForPrivileged: boolean;
}

export interface TraceStep {
  id: string;
  stepType: StepType;
  stepNumber: number;
  timestamp: string;
  agentBelief: string;
  toolName?: ToolName;
  toolDisplayName?: string;
  toolInputArgs?: Record<string, string>;
  toolOutputSummary?: string;
  retryCount: number;
  latencyMs: number;
  tokenUsage: number;
  estimatedCost: number;
  cumulativeCost: number;
  cumulativeTokens: number;
  policyDecision: PolicyDecision;
  policyReason: string;
  recoveryStrategy: RecoveryStrategy;
  recoveryExplanation?: string;
  betterRecoveryStrategy?: string;
  isFailurePoint: boolean;
}

export interface AgentRun {
  id: string;
  userRequest: string;
  agentVersion: string;
  modelConfig: string;
  policyProfileId: string;
  startTime: string;
  endTime: string;
  totalDurationMs: number;
  totalTokens: number;
  totalCost: number;
  status: RunStatus;
  statusReason: string;
  steps: TraceStep[];
  benchmarkTaskId?: string;
  benchmarkCategory?: BenchmarkCategory;
  promptStrategy: string;
}

export interface BenchmarkTask {
  id: string;
  prompt: string;
  category: BenchmarkCategory;
  expectedTools: ToolName[];
  expectedOutcome: RunStatus;
  expectedRetries: number;
  difficulty: 'easy' | 'medium' | 'hard';
  description: string;
  requiresMultipleTools: boolean;
  shouldBlock: boolean;
  ambiguous: boolean;
}

export interface EvalResult {
  taskId: string;
  taskPrompt: string;
  category: BenchmarkCategory;
  agentVersion: string;
  modelConfig: string;
  promptStrategy: string;
  runId: string;
  taskCompletion: number;
  toolSelectionAccuracy: number;
  argumentValidity: number;
  groundedness: number;
  latencyMs: number;
  tokenCost: number;
  retries: number;
  policyViolations: number;
  overallScore: number;
  passed: boolean;
  status: RunStatus;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  model: string;
  promptStrategy: string;
  description: string;
  color: string;
}

export interface RegressionCheck {
  metric: string;
  oldValue: number;
  newValue: number;
  threshold: number;
  isRegression: boolean;
  direction: 'lower_is_better' | 'higher_is_better';
}

export interface ComparisonResult {
  configA: ModelConfig;
  configB: ModelConfig;
  resultsA: EvalResult[];
  resultsB: EvalResult[];
  metricsA: AggregateMetrics;
  metricsB: AggregateMetrics;
  winner: 'A' | 'B' | 'tie';
  regressions: RegressionCheck[];
}

export interface AggregateMetrics {
  successRate: number;
  avgLatency: number;
  p95Latency: number;
  avgCost: number;
  avgTokens: number;
  toolAccuracy: number;
  policyViolations: number;
  avgRetries: number;
  taskCompletion: number;
  argumentValidity: number;
  groundedness: number;
}
