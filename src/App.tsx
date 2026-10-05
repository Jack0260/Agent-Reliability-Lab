import { useState, useMemo } from 'react';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { useAppStore } from '@/hooks/useAppStore';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { Dashboard } from '@/pages/Dashboard';
import { AgentSimulator } from '@/pages/AgentSimulator';
import { FlightRecorder } from '@/pages/FlightRecorder';
import { PolicyEngine } from '@/pages/PolicyEngine';
import { Benchmarks } from '@/pages/Benchmarks';
import { EvalHarness } from '@/pages/EvalHarness';
import { CompareConfigs } from '@/pages/CompareConfigs';

export type PageId =
  | 'dashboard'
  | 'simulator'
  | 'flight-recorder'
  | 'policy'
  | 'benchmarks'
  | 'eval'
  | 'compare';

function AppContent() {
  const [page, setPage] = useState<PageId>('dashboard');
  const store = useAppStore();
  const { theme, toggleTheme } = useTheme();

  const currentPage = useMemo(() => {
    switch (page) {
      case 'dashboard':
        return <Dashboard store={store} />;
      case 'simulator':
        return <AgentSimulator store={store} />;
      case 'flight-recorder':
        return <FlightRecorder store={store} />;
      case 'policy':
        return <PolicyEngine store={store} />;
      case 'benchmarks':
        return <Benchmarks />;
      case 'eval':
        return <EvalHarness store={store} />;
      case 'compare':
        return <CompareConfigs store={store} />;
      default:
        return <Dashboard store={store} />;
    }
  }, [page, store]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar currentPage={page} onNavigate={setPage} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          theme={theme}
          onToggleTheme={toggleTheme}
          activeProfile={store.activeProfile}
          page={page}
        />
        <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-8">
          {currentPage}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
