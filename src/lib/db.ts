import { supabase } from '@/lib/supabase';
import type { AgentRun, TraceStep, PolicyProfile, ModelConfig, BenchmarkTask, EvalResult } from '@/types';

// ===== Types matching DB rows =====

interface RunRow {
  id: string;
  user_request: string;
  agent_version: string;
  model_config: string;
  policy_profile_id: string;
  status: AgentRun['status'];
  status_reason: string;
  total_tokens: number;
  total_cost: number;
  total_duration_ms: number;
  start_time: string;
  end_time: string;
  benchmark_task_id: string | null;
  benchmark_category: BenchmarkTask['category'] | null;
  prompt_strategy: string;
}

interface StepRow {
  id: string;
  run_id: string;
  step_number: number;
  step_type: TraceStep['stepType'];
  agent_belief: string;
  tool_name: string | null;
  tool_display_name: string | null;
  tool_input_args: Record<string, string> | null;
  tool_output_summary: string | null;
  retry_count: number;
  latency_ms: number;
  token_usage: number;
  estimated_cost: number;
  cumulative_cost: number;
  cumulative_tokens: number;
  policy_decision: TraceStep['policyDecision'];
  policy_reason: string;
  recovery_strategy: TraceStep['recoveryStrategy'];
  recovery_explanation: string | null;
  better_recovery_strategy: string | null;
  is_failure_point: boolean;
  timestamp: string;
}

interface ProfileRow {
  id: string;
  name: string;
  description: string;
  max_token_budget: number;
  max_tool_calls: number;
  max_retries: number;
  tool_allowlist: string[];
  read_only_only: boolean;
  redact_sensitive_data: boolean;
  dry_run_for_destructive: boolean;
  human_approval_for_privileged: boolean;
}

interface ConfigRow {
  id: string;
  name: string;
  provider: string;
  model: string;
  prompt_strategy: string;
  description: string;
  color: string;
}

interface TaskRow {
  id: string;
  prompt: string;
  category: BenchmarkTask['category'];
  expected_tools: string[];
  expected_outcome: AgentRun['status'];
  expected_retries: number;
  difficulty: BenchmarkTask['difficulty'];
  description: string;
  requires_multiple_tools: boolean;
  should_block: boolean;
  ambiguous: boolean;
}

interface EvalRow {
  id: string;
  task_id: string;
  run_id: string | null;
  model_config: string;
  agent_version: string;
  prompt_strategy: string;
  task_completion: number;
  tool_selection_accuracy: number;
  argument_validity: number;
  groundedness: number;
  latency_ms: number;
  token_cost: number;
  retries: number;
  policy_violations: number;
  overall_score: number;
  passed: boolean;
  status: AgentRun['status'];
}

// ===== Mappers =====

function mapProfile(r: ProfileRow): PolicyProfile {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    maxTokenBudget: r.max_token_budget,
    maxToolCalls: r.max_tool_calls,
    maxRetries: r.max_retries,
    toolAllowlist: r.tool_allowlist as PolicyProfile['toolAllowlist'],
    readOnlyOnly: r.read_only_only,
    redactSensitiveData: r.redact_sensitive_data,
    dryRunForDestructive: r.dry_run_for_destructive,
    humanApprovalForPrivileged: r.human_approval_for_privileged,
  };
}

function mapConfig(r: ConfigRow): ModelConfig {
  return {
    id: r.id,
    name: r.name,
    provider: r.provider,
    model: r.model,
    promptStrategy: r.prompt_strategy,
    description: r.description,
    color: r.color,
  };
}

function mapTask(r: TaskRow): BenchmarkTask {
  return {
    id: r.id,
    prompt: r.prompt,
    category: r.category,
    expectedTools: r.expected_tools as BenchmarkTask['expectedTools'],
    expectedOutcome: r.expected_outcome,
    expectedRetries: r.expected_retries,
    difficulty: r.difficulty,
    description: r.description,
    requiresMultipleTools: r.requires_multiple_tools,
    shouldBlock: r.should_block,
    ambiguous: r.ambiguous,
  };
}

function mapStep(r: StepRow): TraceStep {
  return {
    id: r.id,
    stepNumber: r.step_number,
    stepType: r.step_type,
    timestamp: r.timestamp,
    agentBelief: r.agent_belief,
    toolName: (r.tool_name ?? undefined) as TraceStep['toolName'],
    toolDisplayName: r.tool_display_name ?? undefined,
    toolInputArgs: r.tool_input_args ?? undefined,
    toolOutputSummary: r.tool_output_summary ?? undefined,
    retryCount: r.retry_count,
    latencyMs: r.latency_ms,
    tokenUsage: r.token_usage,
    estimatedCost: r.estimated_cost,
    cumulativeCost: r.cumulative_cost,
    cumulativeTokens: r.cumulative_tokens,
    policyDecision: r.policy_decision,
    policyReason: r.policy_reason,
    recoveryStrategy: r.recovery_strategy,
    recoveryExplanation: r.recovery_explanation ?? undefined,
    betterRecoveryStrategy: r.better_recovery_strategy ?? undefined,
    isFailurePoint: r.is_failure_point,
  };
}

function mapRun(run: RunRow, steps: TraceStep[]): AgentRun {
  return {
    id: run.id,
    userRequest: run.user_request,
    agentVersion: run.agent_version,
    modelConfig: run.model_config,
    policyProfileId: run.policy_profile_id,
    startTime: run.start_time,
    endTime: run.end_time,
    totalDurationMs: run.total_duration_ms,
    totalTokens: run.total_tokens,
    totalCost: run.total_cost,
    status: run.status,
    statusReason: run.status_reason,
    steps,
    benchmarkTaskId: run.benchmark_task_id ?? undefined,
    benchmarkCategory: run.benchmark_category ?? undefined,
    promptStrategy: run.prompt_strategy,
  };
}

function mapEval(r: EvalRow): EvalResult {
  return {
    taskId: r.task_id,
    taskPrompt: '',
    category: 'single_tool',
    agentVersion: r.agent_version,
    modelConfig: r.model_config,
    promptStrategy: r.prompt_strategy,
    runId: r.run_id ?? '',
    taskCompletion: r.task_completion,
    toolSelectionAccuracy: r.tool_selection_accuracy,
    argumentValidity: r.argument_validity,
    groundedness: r.groundedness,
    latencyMs: r.latency_ms,
    tokenCost: r.token_cost,
    retries: r.retries,
    policyViolations: r.policy_violations,
    overallScore: r.overall_score,
    passed: r.passed,
    status: r.status,
  };
}

// ===== API =====

export async function fetchPolicyProfiles(): Promise<PolicyProfile[]> {
  const { data, error } = await supabase.from('policy_profiles').select('*').order('name');
  if (error) throw error;
  return (data as ProfileRow[]).map(mapProfile);
}

export async function fetchModelConfigs(): Promise<ModelConfig[]> {
  const { data, error } = await supabase.from('model_configs').select('*').order('name');
  if (error) throw error;
  return (data as ConfigRow[]).map(mapConfig);
}

export async function fetchBenchmarkTasks(): Promise<BenchmarkTask[]> {
  const { data, error } = await supabase.from('benchmark_tasks').select('*').order('id');
  if (error) throw error;
  return (data as TaskRow[]).map(mapTask);
}

export async function fetchEvalResults(): Promise<EvalResult[]> {
  const { data, error } = await supabase.from('eval_results').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data as EvalRow[]).map(mapEval);
}

export async function fetchRunsWithSteps(): Promise<AgentRun[]> {
  const { data: runsData, error: runsError } = await supabase
    .from('agent_runs')
    .select('*')
    .order('start_time', { ascending: false });

  if (runsError) throw runsError;
  if (!runsData || runsData.length === 0) return [];

  const runIds = (runsData as RunRow[]).map((r) => r.id);

  const { data: stepsData, error: stepsError } = await supabase
    .from('trace_steps')
    .select('*')
    .in('run_id', runIds)
    .order('run_id', { ascending: true })
    .order('step_number', { ascending: true });

  if (stepsError) throw stepsError;

  const stepsByRun = new Map<string, TraceStep[]>();
  for (const s of (stepsData as StepRow[]) ?? []) {
    const arr = stepsByRun.get(s.run_id) ?? [];
    arr.push(mapStep(s));
    stepsByRun.set(s.run_id, arr);
  }

  return (runsData as RunRow[]).map((run) => mapRun(run, stepsByRun.get(run.id) ?? []));
}

export async function saveAgentRun(run: AgentRun): Promise<void> {
  const runRow = {
    id: run.id,
    user_request: run.userRequest,
    agent_version: run.agentVersion,
    model_config: run.modelConfig,
    policy_profile_id: run.policyProfileId,
    status: run.status,
    status_reason: run.statusReason,
    total_tokens: run.totalTokens,
    total_cost: run.totalCost,
    total_duration_ms: run.totalDurationMs,
    start_time: run.startTime,
    end_time: run.endTime,
    benchmark_task_id: run.benchmarkTaskId ?? null,
    benchmark_category: run.benchmarkCategory ?? null,
    prompt_strategy: run.promptStrategy,
  };

  const { error: runError } = await supabase.from('agent_runs').insert(runRow);
  if (runError) throw runError;

  const stepRows = run.steps.map((s) => ({
    id: s.id,
    run_id: run.id,
    step_number: s.stepNumber,
    step_type: s.stepType,
    agent_belief: s.agentBelief,
    tool_name: s.toolName ?? null,
    tool_display_name: s.toolDisplayName ?? null,
    tool_input_args: s.toolInputArgs ?? null,
    tool_output_summary: s.toolOutputSummary ?? null,
    retry_count: s.retryCount,
    latency_ms: s.latencyMs,
    token_usage: s.tokenUsage,
    estimated_cost: s.estimatedCost,
    cumulative_cost: s.cumulativeCost,
    cumulative_tokens: s.cumulativeTokens,
    policy_decision: s.policyDecision,
    policy_reason: s.policyReason,
    recovery_strategy: s.recoveryStrategy,
    recovery_explanation: s.recoveryExplanation ?? null,
    better_recovery_strategy: s.betterRecoveryStrategy ?? null,
    is_failure_point: s.isFailurePoint,
    timestamp: s.timestamp,
  }));

  const { error: stepsError } = await supabase.from('trace_steps').insert(stepRows);
  if (stepsError) throw stepsError;
}
