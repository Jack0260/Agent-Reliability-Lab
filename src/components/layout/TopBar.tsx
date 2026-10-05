import { Sun, Moon, Shield } from 'lucide-react';
import type { Theme } from '@/context/ThemeContext';
import type { PolicyProfile } from '@/types';
import type { PageId } from '@/App';

const PAGE_TITLES: Record<PageId, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Overall agent performance and reliability metrics' },
  simulator: { title: 'Agent Run', subtitle: 'Run the Data Operations Agent with live tracing' },
  'flight-recorder': { title: 'Agent Flight Recorder', subtitle: 'Replay any agent run step-by-step' },
  eval: { title: 'Evaluation Harness', subtitle: 'Run benchmark suites and score agent quality' },
  benchmarks: { title: 'Benchmark Library', subtitle: '30+ tasks across 7 categories' },
  compare: { title: 'Compare Configurations', subtitle: 'Side-by-side comparison of agent versions' },
  policy: { title: 'Policy Engine', subtitle: 'Configure safety policies and tool restrictions' },
};

export function TopBar({
  theme,
  onToggleTheme,
  activeProfile,
  page,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  activeProfile: PolicyProfile;
  page: PageId;
}) {
  const { title, subtitle } = PAGE_TITLES[page];

  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-6 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80 lg:px-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800/50 sm:flex">
          <Shield className="h-4 w-4 text-primary-600 dark:text-primary-400" />
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {activeProfile.name}
          </span>
        </div>

        <button
          onClick={onToggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-all hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
