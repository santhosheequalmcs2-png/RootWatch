import { useCallback, useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { AppProvider, useApp } from './i18n/LanguageContext';
import { api } from './lib/api';
import { AdvisoryPage } from './pages/AdvisoryPage';
import { AIAnalysisPage } from './pages/AIAnalysisPage';
import { AlertsPage } from './pages/AlertsPage';
import { DashboardPage } from './pages/DashboardPage';
import { DataManagementPage } from './pages/DataManagementPage';
import { DeviceExplorerPage } from './pages/DeviceExplorerPage';
import { DevicesPage } from './pages/DevicesPage';
import { GrowthHistoryPage } from './pages/GrowthHistoryPage';
import { LandingPage } from './pages/LandingPage';
import { RootVisionPage } from './pages/RootVisionPage';
import { SensorsPage } from './pages/SensorsPage';
import { SettingsPage } from './pages/SettingsPage';
import type { PageId } from './types/rootwatch';

const VALID_PAGES: PageId[] = [
  'landing',
  'dashboard',
  'sensors',
  'vision',
  'growth',
  'ai',
  'advisory',
  'alerts',
  'device-3d',
  'devices',
  'data',
  'settings',
];

function resolveInitialPage(): PageId {
  const params = new URLSearchParams(window.location.search);
  if (params.get('autostart') === '1') return 'dashboard';
  const paramPage = params.get('page') as PageId | null;
  if (paramPage && VALID_PAGES.includes(paramPage)) return paramPage;
  const hash = window.location.hash.replace(/^#\/?/, '') as PageId;
  if (VALID_PAGES.includes(hash)) return hash;
  return 'landing';
}

function RootWatchShell() {
  const { refreshTick } = useApp();
  const [page, setPage] = useState<PageId>(() => resolveInitialPage());
  const [activeAlertsCount, setActiveAlertsCount] = useState(0);

  const navigate = useCallback((next: PageId) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'auto' });
    const nextUrl = next === 'landing' ? '/' : `/?page=${next}`;
    window.history.replaceState(null, '', nextUrl);
  }, []);

  useEffect(() => {
    let active = true;
    api
      .getAlerts()
      .then(({ alerts }) => {
        if (active) {
          setActiveAlertsCount(alerts.filter((a) => !a.acknowledged).length);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [refreshTick, page]);

  if (page === 'landing') {
    return <LandingPage onNavigate={navigate} />;
  }

  return (
    <Layout activePage={page} onNavigate={navigate} activeAlertsCount={activeAlertsCount}>
      {page === 'dashboard' && <DashboardPage onNavigate={navigate} />}
      {page === 'sensors' && <SensorsPage />}
      {page === 'vision' && <RootVisionPage />}
      {page === 'growth' && <GrowthHistoryPage />}
      {page === 'ai' && <AIAnalysisPage />}
      {page === 'advisory' && <AdvisoryPage onNavigate={navigate} />}
      {page === 'alerts' && <AlertsPage />}
      {page === 'device-3d' && <DeviceExplorerPage />}
      {page === 'devices' && <DevicesPage />}
      {page === 'data' && <DataManagementPage />}
      {page === 'settings' && <SettingsPage onNavigate={navigate} />}
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <RootWatchShell />
    </AppProvider>
  );
}
