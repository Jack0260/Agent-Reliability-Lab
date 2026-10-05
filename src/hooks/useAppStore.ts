import { useState, useCallback, useMemo, useEffect } from 'react';
import type { AgentRun, PolicyProfile, EvalResult, ModelConfig, BenchmarkTask } from '@/types';
import { SEED_RUNS } from '@/data/seedRuns';
import { POLICY_PROFILES, MODEL_CONFIGS } from '@/data/tools';
import { BENCHMARK_TASKS } from '@/data/benchmarks';
import { generateEvalResultsFromSeeds } from '@/lib/evalScoring';
import {
  fetchRunsWithSteps, saveAgentRun, fetchPolicyProfiles,
  fetchModelConfigs, fetchBenchmarkTasks, fetchEvalResults,
} from '@/lib/db';

export function useAppStore() {
  const [runs, setRuns] = useState<AgentRun[]>(SEED_RUNS);
  const [profiles, setProfiles] = useState<PolicyProfile[]>(POLICY_PROFILES);
  const [configs, setConfigs] = useState<ModelConfig[]>(MODEL_CONFIGS);
  const [tasks, setTasks] = useState<BenchmarkTask[]>(BENCHMARK_TASKS);
  const [activeProfileId, setActiveProfileId] = useState<string>(POLICY_PROFILES[1].id);
  const [evalResults, setEvalResults] = useState<EvalResult[]>(() => generateEvalResultsFromSeeds(SEED_RUNS));
  const [dbConnected, setDbConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load from Supabase on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [dbProfiles, dbConfigs, dbTasks, dbRuns, dbEvals] = await Promise.all([
          fetchPolicyProfiles(),
          fetchModelConfigs(),
          fetchBenchmarkTasks(),
          fetchRunsWithSteps(),
          fetchEvalResults(),
        ]);

        if (cancelled) return;

        if (dbProfiles.length > 0) setProfiles(dbProfiles);
        if (dbConfigs.length > 0) setConfigs(dbConfigs);
        if (dbTasks.length > 0) setTasks(dbTasks);
        if (dbRuns.length > 0) setRuns(dbRuns);
        if (dbEvals.length > 0) setEvalResults(dbEvals);
        setDbConnected(true);
      } catch {
        // Fall back to seeded data — already set in initial state
        setDbConnected(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const addRun = useCallback((run: AgentRun) => {
    setRuns((prev) => [run, ...prev]);
    // Persist to Supabase (fire and forget — errors don't block the UI)
    saveAgentRun(run).catch(() => {
      // Silent failure — the run is still visible in the UI via in-memory state
    });
  }, []);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) ?? profiles[1] ?? POLICY_PROFILES[1],
    [profiles, activeProfileId]
  );

  return {
    runs,
    addRun,
    activeProfile,
    activeProfileId,
    setActiveProfileId,
    evalResults,
    profiles,
    configs,
    tasks,
    dbConnected,
    loading,
  };
}

export type AppStore = ReturnType<typeof useAppStore>;
