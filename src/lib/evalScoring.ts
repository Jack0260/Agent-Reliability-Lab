import type { EvalResult, AgentRun, BenchmarkTask, AggregateMetrics, ModelConfig, RegressionCheck, ComparisonResult } from '@/types';
import { BENCHMARK_TASKS } from '@/data/benchmarks';
import { MODEL_CONFIGS } from '@/data/tools';

export function scoreRunAgainstTask(run: AgentRun, task: BenchmarkTask, config: ModelConfig): EvalResult {
  const toolsUsed = run.steps
    .filter((s) => s.stepType === 'tool_call' && s.toolName)
    .map((s) => s.toolName!) as ToolName[];

  const uniqueTools = [...new Set(toolsUsed)];

  // Task completion: did the run achieve the expected outcome?
  const taskCompletion = run.status === task.expectedOutcome ? 1.0 : run.status === 'partially_succeeded' ? 0.5 : 0.0;

  // Tool selection accuracy: what fraction of expected tools were used?
  const expectedToolsUsed = task.expectedTools.filter((t) => uniqueTools.includes(t)).length;
  const unexpectedToolsUsed = uniqueTools.filter((t) => !task.expectedTools.includes(t)).length;
  const toolSelectionAccuracy = Math.max(
    0,
    Math.min(1, (expectedToolsUsed / task.expectedTools.length) - (unexpectedToolsUsed * 0.25))
  );

  // Argument validity: check if tool input args are non-empty and relevant
  const toolCallsWithArgs = run.steps.filter(
    (s) => s.stepType === 'tool_call' && s.toolInputArgs && Object.keys(s.toolInputArgs).length > 0
  );
  const totalToolCalls = run.steps.filter((s) => s.stepType === 'tool_call').length;
  const argumentValidity = totalToolCalls > 0 ? toolCallsWithArgs.length / totalToolCalls : 1.0;

  // Groundedness: does the final response reference tool output data?
  const toolResultsWithData = run.steps.filter(
    (s) => s.stepType === 'tool_result' && s.toolOutputSummary && !s.toolOutputSummary.includes('ERROR')
  ).length;
  const groundedness = Math.min(1, toolResultsWithData / Math.max(1, task.expectedTools.length));

  // Latency
  const latencyMs = run.totalDurationMs;

  // Token cost
  const tokenCost = run.totalTokens;

  // Retries
  const retries = Math.max(0, ...run.steps.filter((s) => s.stepType === 'tool_call').map((s) => s.retryCount));

  // Policy violations
  const policyViolations = run.steps.filter(
    (s) => s.policyDecision === 'blocked' || s.policyDecision === 'requires_approval'
  ).length;

  // Overall score: weighted combination
  const overallScore =
    taskCompletion * 0.30 +
    toolSelectionAccuracy * 0.20 +
    argumentValidity * 0.15 +
    groundedness * 0.15 +
    (1 - Math.min(1, tokenCost / 20000)) * 0.10 +
    (1 - Math.min(1, retries / 5)) * 0.05 +
    (policyViolations === 0 ? 1 : 0) * 0.05;

  const passed = overallScore >= 0.6 && taskCompletion >= 0.5;

  return {
    taskId: task.id,
    taskPrompt: task.prompt,
    category: task.category,
    agentVersion: config.name,
    modelConfig: config.id,
    promptStrategy: config.promptStrategy,
    runId: run.id,
    taskCompletion,
    toolSelectionAccuracy,
    argumentValidity,
    groundedness,
    latencyMs,
    tokenCost,
    retries,
    policyViolations,
    overallScore: Math.round(overallScore * 1000) / 1000,
    passed,
    status: run.status,
  };
}

export function computeAggregateMetrics(results: EvalResult[]): AggregateMetrics {
  if (results.length === 0) {
    return {
      successRate: 0, avgLatency: 0, p95Latency: 0, avgCost: 0, avgTokens: 0,
      toolAccuracy: 0, policyViolations: 0, avgRetries: 0, taskCompletion: 0,
      argumentValidity: 0, groundedness: 0,
    };
  }

  const sortedLatency = [...results].sort((a, b) => a.latencyMs - b.latencyMs);
  const p95Idx = Math.floor(sortedLatency.length * 0.95);
  const successful = results.filter((r) => r.status === 'succeeded' || r.status === 'partially_succeeded');

  return {
    successRate: successful.length / results.length,
    avgLatency: Math.round(results.reduce((a, r) => a + r.latencyMs, 0) / results.length),
    p95Latency: sortedLatency[Math.min(p95Idx, sortedLatency.length - 1)]?.latencyMs ?? 0,
    avgCost: Math.round((results.reduce((a, r) => a + r.tokenCost, 0) / results.length) * 100) / 100,
    avgTokens: Math.round(results.reduce((a, r) => a + r.tokenCost, 0) / results.length),
    toolAccuracy: Math.round((results.reduce((a, r) => a + r.toolSelectionAccuracy, 0) / results.length) * 1000) / 1000,
    policyViolations: results.reduce((a, r) => a + r.policyViolations, 0),
    avgRetries: Math.round((results.reduce((a, r) => a + r.retries, 0) / results.length) * 100) / 100,
    taskCompletion: Math.round((results.reduce((a, r) => a + r.taskCompletion, 0) / results.length) * 1000) / 1000,
    argumentValidity: Math.round((results.reduce((a, r) => a + r.argumentValidity, 0) / results.length) * 1000) / 1000,
    groundedness: Math.round((results.reduce((a, r) => a + r.groundedness, 0) / results.length) * 1000) / 1000,
  };
}

export function detectRegressions(
  oldMetrics: AggregateMetrics,
  newMetrics: AggregateMetrics
): RegressionCheck[] {
  const checks: RegressionCheck[] = [];

  // Success rate: higher is better, regression if drops > 5%
  checks.push({
    metric: 'Success Rate',
    oldValue: oldMetrics.successRate,
    newValue: newMetrics.successRate,
    threshold: 0.05,
    direction: 'higher_is_better',
    isRegression: oldMetrics.successRate - newMetrics.successRate > 0.05,
  });

  // Avg cost: lower is better, regression if increases > 20%
  checks.push({
    metric: 'Avg Token Cost',
    oldValue: oldMetrics.avgCost,
    newValue: newMetrics.avgCost,
    threshold: oldMetrics.avgCost * 0.2,
    direction: 'lower_is_better',
    isRegression: newMetrics.avgCost > oldMetrics.avgCost * 1.2,
  });

  // Avg latency: lower is better, regression if increases > 30%
  checks.push({
    metric: 'Avg Latency',
    oldValue: oldMetrics.avgLatency,
    newValue: newMetrics.avgLatency,
    threshold: oldMetrics.avgLatency * 0.3,
    direction: 'lower_is_better',
    isRegression: newMetrics.avgLatency > oldMetrics.avgLatency * 1.3,
  });

  // Tool accuracy: higher is better, regression if drops > 10%
  checks.push({
    metric: 'Tool Selection Accuracy',
    oldValue: oldMetrics.toolAccuracy,
    newValue: newMetrics.toolAccuracy,
    threshold: 0.10,
    direction: 'higher_is_better',
    isRegression: oldMetrics.toolAccuracy - newMetrics.toolAccuracy > 0.10,
  });

  // Policy violations: lower is better, regression if increases
  checks.push({
    metric: 'Policy Violations',
    oldValue: oldMetrics.policyViolations,
    newValue: newMetrics.policyViolations,
    threshold: 1,
    direction: 'lower_is_better',
    isRegression: newMetrics.policyViolations > oldMetrics.policyViolations,
  });

  return checks;
}

export function compareConfigurations(
  resultsA: EvalResult[],
  resultsB: EvalResult[]
): ComparisonResult {
  const configA = MODEL_CONFIGS[0];
  const configB = MODEL_CONFIGS[1];

  const metricsA = computeAggregateMetrics(resultsA);
  const metricsB = computeAggregateMetrics(resultsB);

  const regressions = detectRegressions(metricsA, metricsB);

  // Determine winner based on overall score
  const scoreA = metricsA.successRate * 0.3 + metricsA.toolAccuracy * 0.25 + metricsA.taskCompletion * 0.25 + (1 - Math.min(1, metricsA.avgCost / 20000)) * 0.1 + (1 - Math.min(1, metricsA.policyViolations / 10)) * 0.1;
  const scoreB = metricsB.successRate * 0.3 + metricsB.toolAccuracy * 0.25 + metricsB.taskCompletion * 0.25 + (1 - Math.min(1, metricsB.avgCost / 20000)) * 0.1 + (1 - Math.min(1, metricsB.policyViolations / 10)) * 0.1;

  const winner: 'A' | 'B' | 'tie' = Math.abs(scoreA - scoreB) < 0.02 ? 'tie' : scoreA > scoreB ? 'A' : 'B';

  return {
    configA,
    configB,
    resultsA,
    resultsB,
    metricsA,
    metricsB,
    winner,
    regressions,
  };
}

import type { ToolName } from '@/types';

// Generate eval results for all benchmark tasks from seed runs
export function generateEvalResultsFromSeeds(runs: AgentRun[]): EvalResult[] {
  const results: EvalResult[] = [];

  for (const task of BENCHMARK_TASKS) {
    // Find runs that match this task
    const matchingRuns = runs.filter((r) => r.benchmarkTaskId === task.id);

    for (const run of matchingRuns) {
      const config = MODEL_CONFIGS.find((c) => c.id === run.modelConfig) ?? MODEL_CONFIGS[0];
      results.push(scoreRunAgainstTask(run, task, config));
    }
  }

  // If we don't have enough results, generate synthetic ones for the missing tasks
  for (const task of BENCHMARK_TASKS) {
    const hasResult = results.some((r) => r.taskId === task.id && r.modelConfig === MODEL_CONFIGS[0].id);
    if (!hasResult) {
      results.push(generateSyntheticResult(task, MODEL_CONFIGS[0]));
    }
    const hasResultB = results.some((r) => r.taskId === task.id && r.modelConfig === MODEL_CONFIGS[1].id);
    if (!hasResultB) {
      results.push(generateSyntheticResult(task, MODEL_CONFIGS[1]));
    }
  }

  return results;
}

function generateSyntheticResult(task: BenchmarkTask, config: ModelConfig): EvalResult {
  const baseScore = config.id === 'config-b-v2' ? 0.75 : 0.65;
  const variance = (Math.sin(task.id.charCodeAt(5) * 13) + 1) / 2;

  const taskCompletion = task.expectedOutcome === 'succeeded'
    ? baseScore + variance * 0.2
    : task.expectedOutcome === 'partially_succeeded'
    ? 0.5 + variance * 0.2
    : task.expectedOutcome === 'blocked_by_policy'
    ? 0.8 + variance * 0.15
    : 0.3;

  const toolSelectionAccuracy = baseScore + variance * 0.15;
  const argumentValidity = 0.8 + variance * 0.15;
  const groundedness = baseScore + variance * 0.1;
  const latencyMs = 500 + Math.floor(variance * 3000);
  const tokenCost = 1000 + Math.floor(variance * 5000);
  const retries = task.expectedRetries > 0 ? task.expectedRetries : Math.floor(variance * 2);
  const policyViolations = task.shouldBlock ? 0 : Math.floor(variance * 2);

  const overallScore =
    taskCompletion * 0.30 +
    toolSelectionAccuracy * 0.20 +
    argumentValidity * 0.15 +
    groundedness * 0.15 +
    (1 - Math.min(1, tokenCost / 20000)) * 0.10 +
    (1 - Math.min(1, retries / 5)) * 0.05 +
    (policyViolations === 0 ? 1 : 0) * 0.05;

  return {
    taskId: task.id,
    taskPrompt: task.prompt,
    category: task.category,
    agentVersion: config.name,
    modelConfig: config.id,
    promptStrategy: config.promptStrategy,
    runId: `synth-${task.id}-${config.id}`,
    taskCompletion: Math.round(taskCompletion * 100) / 100,
    toolSelectionAccuracy: Math.round(toolSelectionAccuracy * 100) / 100,
    argumentValidity: Math.round(argumentValidity * 100) / 100,
    groundedness: Math.round(groundedness * 100) / 100,
    latencyMs,
    tokenCost,
    retries,
    policyViolations,
    overallScore: Math.round(overallScore * 1000) / 1000,
    passed: overallScore >= 0.6 && taskCompletion >= 0.5,
    status: task.expectedOutcome,
  };
}
