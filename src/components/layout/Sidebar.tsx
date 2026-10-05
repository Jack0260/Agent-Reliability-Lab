import {
  LayoutDashboard,
  Terminal,
  History,
  Shield,
  ListChecks,
  ClipboardCheck,
  GitCompare,
  Radar,
} from 'lucide-react';
import type { PageId } from '@/App';

const NAV_ITEMS: { id: PageId; label: string; icon: typeof LayoutDashboard; description: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview metrics' },
  { id: 'simulator', label: 'Agent Run', icon: Terminal, description: 'Live agent simulator' },
  { id: 'flight-recorder', label: 'Flight Recorder', icon: History, description: 'Replay agent runs' },
  { id: 'eval', label: 'Evaluation', icon: ClipboardCheck, description: 'Benchmark evaluation' },
  { id: 'benchmarks', label: 'Benchmarks', icon: ListChecks, description: 'Task library' },
  { id: 'compare', label: 'Compare', icon: GitCompare, description: 'Config comparison' },
  { id: 'policy', label: 'Policy Engine', icon: Shield, description: 'Safety policies' },
];

export function Sidebar({
  currentPage,
  onNavigate,
}: {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}) {
  return (
    <aside className="flex w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5 dark:border-slate-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white dark:bg-primary-500">
          <Radar className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
            Agent Reliability Lab
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            Evaluation & Observability
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`sidebar-link w-full ${isActive ? 'sidebar-link-active' : ''}`}
            >
              <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-primary-600 dark:text-primary-400' : ''}`} />
              <div className="flex flex-col items-start">
                <span>{item.label}</span>
                <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">
                  {item.description}
                </span>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
            Data Operations Agent
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
            v2.0 — ReAct Prompting
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-success-500 animate-pulse" />
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              Mock Provider Active
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
