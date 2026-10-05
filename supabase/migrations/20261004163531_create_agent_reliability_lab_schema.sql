/*
# Agent Reliability Lab — Core Schema

## Purpose
Creates the full database schema for the Agent Reliability Lab platform:
agent runs, trace steps, benchmark tasks, evaluation results, policy profiles,
and model configurations. This is a single-tenant app with no sign-in screen,
so all policies use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)`
because the data is intentionally shared/public.

## New Tables

1. `policy_profiles` — Safety policy configurations (token budget, tool allowlist, etc.)
   - id (text, PK)
   - name (text, not null)
   - description (text)
   - max_token_budget (int, not null)
   - max_tool_calls (int, not null)
   - max_retries (int, not null)
   - tool_allowlist (text[], not null)
   - read_only_only (boolean, default true)
   - redact_sensitive_data (boolean, default true)
   - dry_run_for_destructive (boolean, default true)
   - human_approval_for_privileged (boolean, default true)
   - created_at (timestamptz, default now())

2. `model_configs` — Agent model configurations (provider, model, prompt strategy)
   - id (text, PK)
   - name (text, not null)
   - provider (text, not null)
   - model (text, not null)
   - prompt_strategy (text, not null)
   - description (text)
   - color (text)
   - created_at (timestamptz, default now())

3. `benchmark_tasks` — Evaluation benchmark tasks (30+ tasks across 7 categories)
   - id (text, PK)
   - prompt (text, not null)
   - category (text, not null)
   - expected_tools (text[], not null)
   - expected_outcome (text, not null)
   - expected_retries (int, default 0)
   - difficulty (text, not null)
   - description (text)
   - requires_multiple_tools (boolean, default false)
   - should_block (boolean, default false)
   - ambiguous (boolean, default false)
   - created_at (timestamptz, default now())

4. `agent_runs` — Full agent run records with status and cost tracking
   - id (text, PK)
   - user_request (text, not null)
   - agent_version (text)
   - model_config (text, references model_configs(id))
   - policy_profile_id (text, references policy_profiles(id))
   - status (text, not null)
   - status_reason (text)
   - total_tokens (int, default 0)
   - total_cost (numeric(10,6), default 0)
   - total_duration_ms (int, default 0)
   - start_time (timestamptz)
   - end_time (timestamptz)
   - benchmark_task_id (text, references benchmark_tasks(id))
   - benchmark_category (text)
   - prompt_strategy (text)
   - created_at (timestamptz, default now())

5. `trace_steps` — Individual steps within an agent run (the full trace)
   - id (text, PK)
   - run_id (text, not null, references agent_runs(id) ON DELETE CASCADE)
   - step_number (int, not null)
   - step_type (text, not null)
   - agent_belief (text)
   - tool_name (text)
   - tool_display_name (text)
   - tool_input_args (jsonb)
   - tool_output_summary (text)
   - retry_count (int, default 0)
   - latency_ms (int, default 0)
   - token_usage (int, default 0)
   - estimated_cost (numeric(10,6), default 0)
   - cumulative_cost (numeric(10,6), default 0)
   - cumulative_tokens (int, default 0)
   - policy_decision (text, not null)
   - policy_reason (text)
   - recovery_strategy (text, default 'none')
   - recovery_explanation (text)
   - better_recovery_strategy (text)
   - is_failure_point (boolean, default false)
   - timestamp (timestamptz, default now())

6. `eval_results` — Scoring results from running benchmark tasks against configs
   - id (uuid, PK, default gen_random_uuid())
   - task_id (text, not null, references benchmark_tasks(id))
   - run_id (text, references agent_runs(id) ON DELETE CASCADE)
   - model_config (text, references model_configs(id))
   - agent_version (text)
   - prompt_strategy (text)
   - task_completion (numeric(3,2), default 0)
   - tool_selection_accuracy (numeric(3,2), default 0)
   - argument_validity (numeric(3,2), default 0)
   - groundedness (numeric(3,2), default 0)
   - latency_ms (int, default 0)
   - token_cost (int, default 0)
   - retries (int, default 0)
   - policy_violations (int, default 0)
   - overall_score (numeric(5,3), default 0)
   - passed (boolean, default false)
   - status (text)
   - created_at (timestamptz, default now())

## Security
- RLS enabled on ALL tables.
- All policies use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)`
  because this is a single-tenant app with no sign-in — all data is intentionally shared.
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE).

## Indexes
- trace_steps: run_id (for querying steps by run)
- agent_runs: status, model_config, benchmark_category
- eval_results: model_config, task_id
*/

-- ===== Policy Profiles =====
CREATE TABLE IF NOT EXISTS policy_profiles (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  max_token_budget int NOT NULL,
  max_tool_calls int NOT NULL,
  max_retries int NOT NULL,
  tool_allowlist text[] NOT NULL,
  read_only_only boolean NOT NULL DEFAULT true,
  redact_sensitive_data boolean NOT NULL DEFAULT true,
  dry_run_for_destructive boolean NOT NULL DEFAULT true,
  human_approval_for_privileged boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE policy_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_policy_profiles" ON policy_profiles;
CREATE POLICY "anon_select_policy_profiles" ON policy_profiles
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_policy_profiles" ON policy_profiles;
CREATE POLICY "anon_insert_policy_profiles" ON policy_profiles
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_policy_profiles" ON policy_profiles;
CREATE POLICY "anon_update_policy_profiles" ON policy_profiles
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_policy_profiles" ON policy_profiles;
CREATE POLICY "anon_delete_policy_profiles" ON policy_profiles
  FOR DELETE TO anon, authenticated USING (true);

-- ===== Model Configs =====
CREATE TABLE IF NOT EXISTS model_configs (
  id text PRIMARY KEY,
  name text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_strategy text NOT NULL,
  description text,
  color text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE model_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_model_configs" ON model_configs;
CREATE POLICY "anon_select_model_configs" ON model_configs
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_model_configs" ON model_configs;
CREATE POLICY "anon_insert_model_configs" ON model_configs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_model_configs" ON model_configs;
CREATE POLICY "anon_update_model_configs" ON model_configs
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_model_configs" ON model_configs;
CREATE POLICY "anon_delete_model_configs" ON model_configs
  FOR DELETE TO anon, authenticated USING (true);

-- ===== Benchmark Tasks =====
CREATE TABLE IF NOT EXISTS benchmark_tasks (
  id text PRIMARY KEY,
  prompt text NOT NULL,
  category text NOT NULL,
  expected_tools text[] NOT NULL,
  expected_outcome text NOT NULL,
  expected_retries int NOT NULL DEFAULT 0,
  difficulty text NOT NULL,
  description text,
  requires_multiple_tools boolean NOT NULL DEFAULT false,
  should_block boolean NOT NULL DEFAULT false,
  ambiguous boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE benchmark_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_benchmark_tasks" ON benchmark_tasks;
CREATE POLICY "anon_select_benchmark_tasks" ON benchmark_tasks
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_benchmark_tasks" ON benchmark_tasks;
CREATE POLICY "anon_insert_benchmark_tasks" ON benchmark_tasks
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_benchmark_tasks" ON benchmark_tasks;
CREATE POLICY "anon_update_benchmark_tasks" ON benchmark_tasks
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_benchmark_tasks" ON benchmark_tasks;
CREATE POLICY "anon_delete_benchmark_tasks" ON benchmark_tasks
  FOR DELETE TO anon, authenticated USING (true);

-- ===== Agent Runs =====
CREATE TABLE IF NOT EXISTS agent_runs (
  id text PRIMARY KEY,
  user_request text NOT NULL,
  agent_version text,
  model_config text REFERENCES model_configs(id),
  policy_profile_id text REFERENCES policy_profiles(id),
  status text NOT NULL,
  status_reason text,
  total_tokens int NOT NULL DEFAULT 0,
  total_cost numeric(10,6) NOT NULL DEFAULT 0,
  total_duration_ms int NOT NULL DEFAULT 0,
  start_time timestamptz,
  end_time timestamptz,
  benchmark_task_id text REFERENCES benchmark_tasks(id),
  benchmark_category text,
  prompt_strategy text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_agent_runs" ON agent_runs;
CREATE POLICY "anon_select_agent_runs" ON agent_runs
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_agent_runs" ON agent_runs;
CREATE POLICY "anon_insert_agent_runs" ON agent_runs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_agent_runs" ON agent_runs;
CREATE POLICY "anon_update_agent_runs" ON agent_runs
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_agent_runs" ON agent_runs;
CREATE POLICY "anon_delete_agent_runs" ON agent_runs
  FOR DELETE TO anon, authenticated USING (true);

-- ===== Trace Steps =====
CREATE TABLE IF NOT EXISTS trace_steps (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_number int NOT NULL,
  step_type text NOT NULL,
  agent_belief text,
  tool_name text,
  tool_display_name text,
  tool_input_args jsonb,
  tool_output_summary text,
  retry_count int NOT NULL DEFAULT 0,
  latency_ms int NOT NULL DEFAULT 0,
  token_usage int NOT NULL DEFAULT 0,
  estimated_cost numeric(10,6) NOT NULL DEFAULT 0,
  cumulative_cost numeric(10,6) NOT NULL DEFAULT 0,
  cumulative_tokens int NOT NULL DEFAULT 0,
  policy_decision text NOT NULL,
  policy_reason text,
  recovery_strategy text NOT NULL DEFAULT 'none',
  recovery_explanation text,
  better_recovery_strategy text,
  is_failure_point boolean NOT NULL DEFAULT false,
  timestamp timestamptz DEFAULT now()
);

ALTER TABLE trace_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_trace_steps" ON trace_steps;
CREATE POLICY "anon_select_trace_steps" ON trace_steps
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_trace_steps" ON trace_steps;
CREATE POLICY "anon_insert_trace_steps" ON trace_steps
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_trace_steps" ON trace_steps;
CREATE POLICY "anon_update_trace_steps" ON trace_steps
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_trace_steps" ON trace_steps;
CREATE POLICY "anon_delete_trace_steps" ON trace_steps
  FOR DELETE TO anon, authenticated USING (true);

-- ===== Eval Results =====
CREATE TABLE IF NOT EXISTS eval_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL REFERENCES benchmark_tasks(id),
  run_id text REFERENCES agent_runs(id) ON DELETE CASCADE,
  model_config text REFERENCES model_configs(id),
  agent_version text,
  prompt_strategy text,
  task_completion numeric(3,2) NOT NULL DEFAULT 0,
  tool_selection_accuracy numeric(3,2) NOT NULL DEFAULT 0,
  argument_validity numeric(3,2) NOT NULL DEFAULT 0,
  groundedness numeric(3,2) NOT NULL DEFAULT 0,
  latency_ms int NOT NULL DEFAULT 0,
  token_cost int NOT NULL DEFAULT 0,
  retries int NOT NULL DEFAULT 0,
  policy_violations int NOT NULL DEFAULT 0,
  overall_score numeric(5,3) NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  status text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE eval_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_eval_results" ON eval_results;
CREATE POLICY "anon_select_eval_results" ON eval_results
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_eval_results" ON eval_results;
CREATE POLICY "anon_insert_eval_results" ON eval_results
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_eval_results" ON eval_results;
CREATE POLICY "anon_update_eval_results" ON eval_results
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_eval_results" ON eval_results;
CREATE POLICY "anon_delete_eval_results" ON eval_results
  FOR DELETE TO anon, authenticated USING (true);

-- ===== Indexes =====
CREATE INDEX IF NOT EXISTS idx_trace_steps_run_id ON trace_steps(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_model_config ON agent_runs(model_config);
CREATE INDEX IF NOT EXISTS idx_agent_runs_benchmark_category ON agent_runs(benchmark_category);
CREATE INDEX IF NOT EXISTS idx_eval_results_model_config ON eval_results(model_config);
CREATE INDEX IF NOT EXISTS idx_eval_results_task_id ON eval_results(task_id);
