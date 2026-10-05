import type {
  AgentRun,
  TraceStep,
  RunStatus,
  ToolName,
  PolicyProfile,
  PolicyDecision,
  RecoveryStrategy,
  BenchmarkCategory,
} from '@/types';
import { TOOLS } from '@/data/tools';

let simStepCounter = 0;

function randomId(): string {
  return `run-sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface SimStepDef {
  stepType: TraceStep['stepType'];
  agentBelief: string;
  toolName?: ToolName;
  toolInputArgs?: Record<string, string>;
  toolOutputSummary?: string;
  retryCount?: number;
  latencyMs: number;
  tokenUsage: number;
  estimatedCost: number;
  policyDecision: PolicyDecision;
  policyReason: string;
  recoveryStrategy?: RecoveryStrategy;
  recoveryExplanation?: string;
  betterRecoveryStrategy?: string;
  isFailurePoint?: boolean;
}

function checkPolicy(
  toolName: ToolName,
  profile: PolicyProfile,
  cumulativeTokens: number,
  cumulativeToolCalls: number
): { decision: PolicyDecision; reason: string } {
  const tool = TOOLS.find((t) => t.name === toolName);
  if (!tool) {
    return { decision: 'blocked', reason: `Unknown tool: ${toolName}` };
  }

  if (!profile.toolAllowlist.includes(toolName)) {
    return {
      decision: 'blocked',
      reason: `BLOCKED: ${tool.displayName} is not in the tool allowlist for the "${profile.name}" policy. This tool is not permitted under the current configuration.`,
    };
  }

  if (profile.readOnlyOnly && !tool.isReadOnly) {
    return {
      decision: 'blocked',
      reason: `BLOCKED: The "${profile.name}" policy restricts to read-only tools. ${tool.displayName} is not read-only.`,
    };
  }

  if (tool.isDestructive && profile.dryRunForDestructive) {
    if (tool.requiresApproval && profile.humanApprovalForPrivileged) {
      return {
        decision: 'requires_approval',
        reason: `BLOCKED: ${tool.displayName} is a destructive/privileged operation. The policy requires dry-run and human approval before execution. This action cannot proceed automatically.`,
      };
    }
    return {
      decision: 'dry_run_required',
      reason: `${tool.displayName} is destructive. A dry-run is required before execution under the "${profile.name}" policy.`,
    };
  }

  if (cumulativeTokens >= profile.maxTokenBudget) {
    return {
      decision: 'blocked',
      reason: `BLOCKED: Token budget exhausted. Cumulative tokens (${cumulativeTokens}) exceed the maximum budget (${profile.maxTokenBudget}).`,
    };
  }

  if (cumulativeToolCalls >= profile.maxToolCalls) {
    return {
      decision: 'blocked',
      reason: `BLOCKED: Tool call limit reached. ${cumulativeToolCalls} calls used, limit is ${profile.maxToolCalls}.`,
    };
  }

  return {
    decision: 'allowed',
    reason: `${tool.displayName} is in the allowlist and ${tool.isReadOnly ? 'read-only' : 'a draft tool'}. No policy violation.`,
  };
}

function detectUnsafeRequest(request: string): boolean {
  const unsafePatterns = [
    /rm\s+-rf/i,
    /drop\s+table/i,
    /delete\s+from/i,
    /truncate/i,
    /shutdown/i,
    /restart.*production/i,
    /execute.*command/i,
    /systemctl/i,
    /kill\s+-9/i,
    /drop\s+database/i,
    /wipe/i,
    /flushall/i,
  ];
  return unsafePatterns.some((p) => p.test(request));
}

function detectAmbiguousRequest(request: string): boolean {
  const ambiguousPatterns = [
    /something is wrong/i,
    /fix the issue/i,
    /look into/i,
    /tell me about/i,
    /\bthe errors\b/i,
    /\bthe data\b/i,
    /\bthe pipeline\b/i,
  ];
  return ambiguousPatterns.some((p) => p.test(request));
}

function detectBroadRequest(request: string): boolean {
  const broadPatterns = [
    /\bevery\b/i,
    /\ball\b/i,
    /\beverything\b/i,
    /\bcomprehensive\b/i,
    /\bthoroughly\b/i,
  ];
  return broadPatterns.some((p) => p.test(request));
}

export interface SimulationResult {
  run: AgentRun;
  steps: TraceStep[];
}

export function simulateAgentRun(
  userRequest: string,
  profile: PolicyProfile,
  modelConfigId: string,
  modelConfigName: string,
  promptStrategy: string
): SimulationResult {
  simStepCounter = 0;
  const runId = randomId();
  const startTime = new Date().toISOString();
  let cumCost = 0;
  let cumTokens = 0;
  let cumToolCalls = 0;
  const steps: TraceStep[] = [];
  let stepNum = 0;

  function addStep(def: SimStepDef): TraceStep {
    stepNum += 1;
    simStepCounter += 1;
    cumCost += def.estimatedCost;
    cumTokens += def.tokenUsage;
    const step: TraceStep = {
      id: `sim-step-${simStepCounter}`,
      stepNumber: stepNum,
      timestamp: new Date(Date.now() + stepNum * 1000).toISOString(),
      stepType: def.stepType,
      agentBelief: def.agentBelief,
      toolName: def.toolName,
      toolDisplayName: def.toolName ? TOOLS.find((t) => t.name === def.toolName)?.displayName : undefined,
      toolInputArgs: def.toolInputArgs,
      toolOutputSummary: def.toolOutputSummary,
      retryCount: def.retryCount ?? 0,
      latencyMs: def.latencyMs,
      tokenUsage: def.tokenUsage,
      estimatedCost: def.estimatedCost,
      cumulativeCost: cumCost,
      cumulativeTokens: cumTokens,
      policyDecision: def.policyDecision,
      policyReason: def.policyReason,
      recoveryStrategy: def.recoveryStrategy ?? 'none',
      recoveryExplanation: def.recoveryExplanation,
      betterRecoveryStrategy: def.betterRecoveryStrategy,
      isFailurePoint: def.isFailurePoint ?? false,
    };
    steps.push(step);
    return step;
  }

  // === Planning step ===
  addStep({
    stepType: 'plan',
    agentBelief: `Analyzing user request: "${userRequest}". Determining which tools are needed and in what order.`,
    latencyMs: 80 + Math.floor(Math.random() * 40),
    tokenUsage: 150 + Math.floor(Math.random() * 100),
    estimatedCost: 0.0004,
    policyDecision: 'allowed',
    policyReason: 'Planning step — no tool execution, no policy check needed.',
  });

  // === Check for unsafe request ===
  if (detectUnsafeRequest(userRequest)) {
    addStep({
      stepType: 'tool_call',
      agentBelief: 'The user is requesting a destructive or privileged production operation. I must check if this tool is allowed before executing.',
      toolName: 'execute_production_command',
      toolInputArgs: { command: userRequest.slice(0, 100) },
      latencyMs: 0,
      tokenUsage: 100,
      estimatedCost: 0.01,
      policyDecision: 'blocked',
      policyReason: `BLOCKED: execute_production_command is a destructive tool that is NOT in the tool allowlist. Destructive operations are never allowed without explicit dry-run and human approval. This request would cause irreversible damage to production systems.`,
      recoveryStrategy: 'refuse_and_log',
      recoveryExplanation: 'Request refused. The destructive production operation is blocked by the safety policy. Reason logged to policy violation log.',
      betterRecoveryStrategy: 'The agent should refuse immediately, explain that destructive production operations are not permitted, and suggest safe alternatives such as contacting the on-call SRE team or using the documented change management procedure.',
      isFailurePoint: true,
    });

    const status: RunStatus = 'blocked_by_policy';
    return finalizeRun(runId, userRequest, profile, modelConfigId, modelConfigName, promptStrategy, steps, startTime, status, 'Destructive production operation blocked by safety policy.');
  }

  // === Check for ambiguous request ===
  if (detectAmbiguousRequest(userRequest)) {
    const queryTool: ToolName = 'query_analytics';
    const polCheck = checkPolicy(queryTool, profile, cumTokens, cumToolCalls);

    addStep({
      stepType: 'tool_call',
      agentBelief: 'The request is ambiguous. I will try a broad query to gather context, then ask the user for clarification.',
      toolName: queryTool,
      toolInputArgs: { metric: 'system_overview', timeframe: '1h' },
      latencyMs: 200,
      tokenUsage: 100,
      estimatedCost: 0.003,
      policyDecision: polCheck.decision,
      policyReason: polCheck.reason,
    });

    if (polCheck.decision === 'allowed') {
      cumToolCalls += 1;
      addStep({
        stepType: 'tool_result',
        agentBelief: 'The broad query returned data but I cannot determine the specific issue the user is referring to. I should ask for clarification.',
        toolName: queryTool,
        toolOutputSummary: 'System overview queried. Multiple services and metrics available. No specific anomaly detected without more context.',
        latencyMs: 0,
        tokenUsage: 200,
        estimatedCost: 0.0004,
        policyDecision: 'allowed',
        policyReason: 'Read-only result returned.',
        recoveryStrategy: 'ask_clarifying_question',
        recoveryExplanation: 'The request is too vague to take specific action. Asking the user to clarify: which service, what kind of problem, and when they noticed it.',
        isFailurePoint: true,
      });
    }

    addStep({
      stepType: 'final',
      agentBelief: 'The request was ambiguous. I queried for a general overview but could not identify the specific issue. I am asking the user to provide more details.',
      latencyMs: 50,
      tokenUsage: 200,
      estimatedCost: 0.0004,
      policyDecision: 'allowed',
      policyReason: 'Final response with clarifying question.',
    });

    return finalizeRun(runId, userRequest, profile, modelConfigId, modelConfigName, promptStrategy, steps, startTime, 'partially_succeeded', 'Ambiguous request. Agent gathered general data and asked for clarification.');
  }

  // === Check for broad/unbounded request ===
  if (detectBroadRequest(userRequest)) {
    const tools: ToolName[] = ['query_analytics', 'query_analytics', 'query_analytics', 'query_analytics', 'query_analytics'];
    let budgetExhausted = false;

    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      const polCheck = checkPolicy(tool, profile, cumTokens, cumToolCalls);

      if (polCheck.decision !== 'allowed') {
        addStep({
          stepType: 'tool_call',
          agentBelief: `Step ${i + 1}: Attempting to query analytics for service ${i + 1}. Budget is at ${cumTokens}/${profile.maxTokenBudget} tokens.`,
          toolName: tool,
          toolInputArgs: { metric: 'all', service: `service-${i + 1}`, timeframe: '30d' },
          latencyMs: 0,
          tokenUsage: 100,
          estimatedCost: 0.003,
          policyDecision: polCheck.decision,
          policyReason: polCheck.reason,
        });
        budgetExhausted = true;
        break;
      }

      cumToolCalls += 1;
      addStep({
        stepType: 'tool_call',
        agentBelief: `Step ${i + 1}: Querying analytics for service ${i + 1}. Budget at ${cumTokens}/${profile.maxTokenBudget}.`,
        toolName: tool,
        toolInputArgs: { metric: 'all', service: `service-${i + 1}`, timeframe: '30d' },
        latencyMs: 300 + Math.floor(Math.random() * 100),
        tokenUsage: 1200 + Math.floor(Math.random() * 300),
        estimatedCost: 0.003,
        policyDecision: 'allowed',
        policyReason: polCheck.reason,
      });

      addStep({
        stepType: 'tool_result',
        agentBelief: `Got data for service ${i + 1}. Budget at ${cumTokens}/${profile.maxTokenBudget}. ${5 - i - 1} services remaining.`,
        toolName: tool,
        toolOutputSummary: `Service ${i + 1} (30d): error_rate avg ${1 + Math.random() * 4}%, p99 latency ${200 + Math.random() * 800}ms, throughput ${100 + Math.random() * 500} req/s.`,
        latencyMs: 0,
        tokenUsage: 1500,
        estimatedCost: 0.003,
        policyDecision: 'allowed',
        policyReason: `Read-only result. Budget: ${Math.round((cumTokens / profile.maxTokenBudget) * 100)}% used.`,
      });

      if (cumTokens >= profile.maxTokenBudget * 0.9) {
        addStep({
          stepType: 'tool_result',
          agentBelief: `Token budget nearly exhausted (${cumTokens}/${profile.maxTokenBudget}). I cannot complete all remaining queries. I must return partial results.`,
          toolName: tool,
          toolOutputSummary: `Budget critical: ${Math.round((cumTokens / profile.maxTokenBudget) * 100)}% used. Returning partial results for ${i + 1} of ${tools.length} services.`,
          latencyMs: 0,
          tokenUsage: 100,
          estimatedCost: 0.0002,
          policyDecision: 'allowed',
          policyReason: 'Budget critical.',
          recoveryStrategy: 'return_partial_result',
          recoveryExplanation: `Token budget nearly exhausted. Returning partial results for ${i + 1} services. Recommend narrowing scope or increasing budget.`,
          isFailurePoint: true,
        });
        budgetExhausted = true;
        break;
      }
    }

    addStep({
      stepType: 'final',
      agentBelief: budgetExhausted
        ? 'I was unable to complete the full investigation due to budget exhaustion. I am returning a partial structured result with the data collected so far.'
        : 'I have completed the investigation across all services.',
      latencyMs: 50,
      tokenUsage: 300,
      estimatedCost: 0.0006,
      policyDecision: 'allowed',
      policyReason: 'Final response.',
      recoveryStrategy: budgetExhausted ? 'return_partial_result' : 'none',
    });

    const status: RunStatus = budgetExhausted ? 'budget_exhausted' : 'succeeded';
    return finalizeRun(runId, userRequest, profile, modelConfigId, modelConfigName, promptStrategy, steps, startTime, status, budgetExhausted ? 'Token budget exhausted. Partial results returned.' : 'Investigation completed.');
  }

  // === Normal multi-tool flow ===
  // Determine which tools to use based on keywords in the request
  const toolsToCall: { name: ToolName; args: Record<string, string> }[] = [];

  if (/search|kb|incident|knowledge/i.test(userRequest)) {
    toolsToCall.push({ name: 'search_incident_kb', args: { query: userRequest.slice(0, 60) } });
  }
  if (/analytics|metric|error rate|latency|users|active|query/i.test(userRequest)) {
    toolsToCall.push({ name: 'query_analytics', args: { metric: 'error_rate', timeframe: '24h' } });
  }
  if (/pipeline|health|etl|kafka|streaming/i.test(userRequest)) {
    toolsToCall.push({ name: 'check_pipeline_health', args: { pipeline: 'auto-detect' } });
  }
  if (/report|draft|incident report/i.test(userRequest)) {
    toolsToCall.push({ name: 'create_draft_report', args: { title: `Investigation Report — ${new Date().toISOString().slice(0, 10)}`, severity: 'P2' } });
  }
  if (/remediation|checklist|fix|resolve/i.test(userRequest)) {
    toolsToCall.push({ name: 'draft_remediation_checklist', args: { incidentType: 'auto-detected' } });
  }

  // If no tools matched, do a default KB search
  if (toolsToCall.length === 0) {
    toolsToCall.push({ name: 'search_incident_kb', args: { query: userRequest.slice(0, 60) } });
  }

  let failed = false;
  let partial = false;

  for (const toolCall of toolsToCall) {
    if (cumTokens >= profile.maxTokenBudget) {
      addStep({
        stepType: 'tool_call',
        agentBelief: `I need to call ${toolCall.name} but the token budget is exhausted (${cumTokens}/${profile.maxTokenBudget}). I must return partial results.`,
        toolName: toolCall.name,
        toolInputArgs: toolCall.args,
        latencyMs: 0,
        tokenUsage: 50,
        estimatedCost: 0.0001,
        policyDecision: 'blocked',
        policyReason: `BLOCKED: Token budget exhausted (${cumTokens}/${profile.maxTokenBudget}).`,
        recoveryStrategy: 'return_partial_result',
        recoveryExplanation: 'Token budget exhausted. Returning partial results.',
        isFailurePoint: true,
      });
      partial = true;
      break;
    }

    const polCheck = checkPolicy(toolCall.name, profile, cumTokens, cumToolCalls);
    const tool = TOOLS.find((t) => t.name === toolCall.name)!;

    addStep({
      stepType: 'tool_call',
      agentBelief: `I will call ${tool.displayName} to ${tool.description.toLowerCase()}`,
      toolName: toolCall.name,
      toolInputArgs: toolCall.args,
      latencyMs: tool.avgLatencyMs + Math.floor(Math.random() * 50),
      tokenUsage: 80 + Math.floor(Math.random() * 40),
      estimatedCost: tool.avgCostPerCall,
      policyDecision: polCheck.decision,
      policyReason: polCheck.reason,
    });

    if (polCheck.decision === 'blocked' || polCheck.decision === 'requires_approval') {
      failed = true;
      addStep({
        stepType: 'tool_result',
        agentBelief: `The policy blocked this tool call. I cannot proceed with this action.`,
        toolName: toolCall.name,
        toolOutputSummary: `Tool call blocked by policy: ${polCheck.reason}`,
        latencyMs: 0,
        tokenUsage: 100,
        estimatedCost: 0.0002,
        policyDecision: polCheck.decision,
        policyReason: polCheck.reason,
        recoveryStrategy: 'refuse_and_log',
        recoveryExplanation: 'Tool call blocked by safety policy. Reason logged.',
        betterRecoveryStrategy: 'The agent should explain the policy restriction to the user and suggest alternative approaches that are within the allowed tool set.',
        isFailurePoint: true,
      });
      break;
    }

    cumToolCalls += 1;

    // Simulate tool result
    const outputSummary = generateToolOutput(toolCall.name, toolCall.args);
    addStep({
      stepType: 'tool_result',
      agentBelief: `The ${tool.displayName} returned data. I can use this to continue the investigation.`,
      toolName: toolCall.name,
      toolOutputSummary: outputSummary,
      latencyMs: 0,
      tokenUsage: 200 + Math.floor(Math.random() * 150),
      estimatedCost: 0.0005,
      policyDecision: 'allowed',
      policyReason: 'Read-only/draft result returned. No policy violation.',
    });

    // Simulate intermittent failure + retry on ~20% of calls
    if (Math.random() < 0.2 && profile.maxRetries > 0) {
      addStep({
        stepType: 'tool_result',
        agentBelief: `The ${tool.displayName} timed out. I will retry with exponential backoff.`,
        toolName: toolCall.name,
        toolOutputSummary: 'ERROR: Request timed out.',
        latencyMs: 0,
        tokenUsage: 80,
        estimatedCost: 0.00016,
        retryCount: 0,
        policyDecision: 'allowed',
        policyReason: `Retry 1 of ${profile.maxRetries} allowed.`,
        recoveryStrategy: 'retry_with_backoff',
        recoveryExplanation: 'Exponential backoff: waiting 1s before retry.',
        isFailurePoint: true,
      });

      // Retry succeeds
      addStep({
        stepType: 'tool_call',
        agentBelief: `Retrying ${tool.displayName} after 1s backoff.`,
        toolName: toolCall.name,
        toolInputArgs: toolCall.args,
        latencyMs: tool.avgLatencyMs,
        tokenUsage: 80,
        estimatedCost: tool.avgCostPerCall,
        retryCount: 1,
        policyDecision: 'allowed',
        policyReason: `Retry 1 of ${profile.maxRetries}.`,
      });

      addStep({
        stepType: 'tool_result',
        agentBelief: `Retry succeeded. Got the data from ${tool.displayName}.`,
        toolName: toolCall.name,
        toolOutputSummary: outputSummary,
        latencyMs: 0,
        tokenUsage: 200,
        estimatedCost: 0.0004,
        retryCount: 1,
        policyDecision: 'allowed',
        policyReason: 'Result returned after retry.',
      });
    }
  }

  // Final step
  let finalStatus: RunStatus = 'succeeded';
  let statusReason = 'Task completed successfully.';

  if (failed) {
    finalStatus = 'blocked_by_policy';
    statusReason = 'Tool call blocked by safety policy.';
  } else if (partial) {
    finalStatus = 'budget_exhausted';
    statusReason = 'Token budget exhausted. Partial results returned.';
  }

  addStep({
    stepType: 'final',
    agentBelief: failed
      ? 'I was unable to complete the task because a tool call was blocked by the safety policy.'
      : partial
      ? 'I was unable to complete all steps due to budget exhaustion. Returning partial results.'
      : 'I have completed the task successfully using the available tools.',
    latencyMs: 50,
    tokenUsage: 200,
    estimatedCost: 0.0004,
    policyDecision: 'allowed',
    policyReason: 'Final response.',
    recoveryStrategy: partial ? 'return_partial_result' : failed ? 'refuse_and_log' : 'none',
  });

  return finalizeRun(runId, userRequest, profile, modelConfigId, modelConfigName, promptStrategy, steps, startTime, finalStatus, statusReason);
}

function generateToolOutput(toolName: ToolName, args: Record<string, string>): string {
  switch (toolName) {
    case 'search_incident_kb':
      return `Found ${1 + Math.floor(Math.random() * 3)} incidents matching "${args.query || 'query'}". Top result: INC-2024-${100 + Math.floor(Math.random() * 50)} — related to the query. Status: resolved. Root cause available in post-mortem.`;
    case 'query_analytics':
      return `Analytics query returned: ${args.metric || 'metric'} = ${(Math.random() * 5).toFixed(2)}% for ${args.service || 'all services'} over ${args.timeframe || '24h'}. Trend: ${Math.random() > 0.5 ? 'increasing' : 'stable'}.`;
    case 'check_pipeline_health':
      return `Pipeline "${args.pipeline || 'auto-detected'}" status: ${Math.random() > 0.7 ? 'DEGRADED' : 'HEALTHY'}. ${Math.random() > 0.7 ? 'Elevated error rate detected.' : 'All metrics within normal bounds.'}`;
    case 'create_draft_report':
      return `Draft report DR-2024-${300 + Math.floor(Math.random() * 99)} created. Title: "${args.title || 'Investigation Report'}". Status: DRAFT. Contains: incident summary, timeline, and preliminary analysis.`;
    case 'draft_remediation_checklist':
      return `Remediation checklist RC-2024-${50 + Math.floor(Math.random() * 20)} created. ${3 + Math.floor(Math.random() * 3)} action items drafted. Status: DRAFT — pending human review.`;
    default:
      return 'Tool executed.';
  }
}

function finalizeRun(
  runId: string,
  userRequest: string,
  profile: PolicyProfile,
  modelConfigId: string,
  modelConfigName: string,
  promptStrategy: string,
  steps: TraceStep[],
  startTime: string,
  status: RunStatus,
  statusReason: string
): SimulationResult {
  const totalDuration = steps.reduce((a, s) => a + s.latencyMs, 0);
  const totalTokens = steps.reduce((a, s) => a + s.tokenUsage, 0);
  const totalCost = steps.reduce((a, s) => a + s.estimatedCost, 0);

  const run: AgentRun = {
    id: runId,
    userRequest,
    agentVersion: 'v2.0',
    modelConfig: modelConfigId,
    policyProfileId: profile.id,
    startTime,
    endTime: new Date().toISOString(),
    totalDurationMs: totalDuration,
    totalTokens,
    totalCost: Math.round(totalCost * 10000) / 10000,
    status,
    statusReason,
    steps,
    promptStrategy,
  };

  return { run, steps };
}
