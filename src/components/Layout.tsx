import {
  Activity,
  AlertTriangle,
  Box,
  Cpu,
  Database,
  Eye,
  GitCompare,
  Globe,
  Home,
  LayoutDashboard,
  Menu,
  Moon,
  Radio,
  Settings,
  Sprout,
  Sun,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { useApp } from '../i18n/LanguageContext';
import type { PageId } from '../types/rootwatch';
import { BrandLogo } from './BrandLogo';

interface LayoutProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  activeAlertsCount: number;
  children: React.ReactNode;
}

interface NavGroup {
  labelKey: string;
  items: { id: PageId; labelKey: string; icon: React.ComponentType<{ className?: string }> }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'nav_overview_group',
    items: [
      { id: 'dashboard', labelKey: 'nav_dashboard', icon: LayoutDashboard },
      { id: 'sensors', labelKey: 'nav_sensors', icon: Activity },
      { id: 'advisory', labelKey: 'nav_advisory', icon: Sprout },
      { id: 'alerts', labelKey: 'nav_alerts', icon: AlertTriangle },
    ],
  },
  {
    labelKey: 'nav_intelligence_group',
    items: [
      { id: 'vision', labelKey: 'nav_vision', icon: Eye },
      { id: 'growth', labelKey: 'nav_growth', icon: GitCompare },
      { id: 'ai', labelKey: 'nav_ai', icon: Cpu },
    ],
  },
  {
    labelKey: 'nav_hardware_group',
    items: [
      { id: 'device-3d', labelKey: 'nav_device_3d', icon: Box },
      { id: 'devices', labelKey: 'nav_devices', icon: Radio },
      { id: 'data', labelKey: 'nav_data', icon: Database },
      { id: 'settings', labelKey: 'nav_settings', icon: Settings },
    ],
  },
];

const PAGE_LABEL_MAP: Record<PageId, string> = {
  landing: 'nav_home',
  dashboard: 'nav_dashboard',
  sensors: 'nav_sensors',
  vision: 'nav_vision',
  growth: 'nav_growth',
  ai: 'nav_ai',
  advisory: 'nav_advisory',
  alerts: 'nav_alerts',
  'device-3d': 'nav_device_3d',
  devices: 'nav_devices',
  data: 'nav_data',
  settings: 'nav_settings',
};

export function Layout({ activePage, onNavigate, activeAlertsCount, children }: LayoutProps) {
  const { language, toggleLanguage, theme, toggleTheme, t, toast } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (page: PageId) => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  const renderSidebarNav = () => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-[#DCE3DD] px-5 dark:border-[#1E3126]">
        <button
          type="button"
          onClick={() => handleNav('landing')}
          className="text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E7D4F]"
          aria-label={t('nav_back_landing')}
        >
          <BrandLogo />
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation menu"
          className="rounded-lg p-1.5 text-[#4B6155] hover:bg-[#EAF0EB] lg:hidden dark:text-[#9CB3A6] dark:hover:bg-[#192B21]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Primary Workspace">
        {NAV_GROUPS.map((group) => (
          <div key={group.labelKey}>
            <div className="px-3 pb-2 text-xs font-medium text-[#5C7266] dark:text-[#86A092]">
              {t(group.labelKey)}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activePage === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleNav(item.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`flex w-full items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-[#153625] text-white dark:bg-[#24593C] dark:text-white'
                          : 'text-[#2C4236] hover:bg-[#EBF0EB] hover:text-[#122B1E] dark:text-[#B9CEC2] dark:hover:bg-[#16261D] dark:hover:text-white'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5 truncate">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{t(item.labelKey)}</span>
                      </span>
                      {item.id === 'alerts' && activeAlertsCount > 0 && (
                        <span
                          className={`font-mono text-xs tabular-nums ${
                            active ? 'text-[#A8ECC0]' : 'text-[#B45309] dark:text-[#FBBF24]'
                          }`}
                        >
                          {activeAlertsCount}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[#DCE3DD] p-4 dark:border-[#1E3126]">
        <button
          type="button"
          onClick={() => handleNav('landing')}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#4A6154] transition-colors hover:bg-[#EBF0EB] hover:text-[#122B1E] dark:text-[#98B2A4] dark:hover:bg-[#16261D] dark:hover:text-white whitespace-nowrap"
        >
          <Home className="h-3.5 w-3.5 shrink-0" />
          <span>{t('nav_back_landing')}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F8F7F3] text-[#14231B] dark:bg-[#0C1410] dark:text-[#ECF3EE]">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-[#DCE3DD] bg-[#F3F4EF] lg:block dark:border-[#1E3126] dark:bg-[#101C16]">
        <div className="sticky top-0 h-screen">{renderSidebarNav()}</div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-72 max-w-[85vw] bg-[#F3F4EF] shadow-xl dark:bg-[#101C16]">
            {renderSidebarNav()}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Workspace Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[#DCE3DD] bg-[#F8F7F3]/95 px-4 sm:px-6 dark:border-[#1E3126] dark:bg-[#0C1410]/95">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-lg border border-[#D4DCD5] p-2 text-[#2A4034] hover:bg-[#EBF0EB] lg:hidden dark:border-[#24382C] dark:text-[#CBE0D4] dark:hover:bg-[#16261D]"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="hidden text-[#5D7367] sm:inline dark:text-[#86A092]">
                {t('brand_name')}
              </span>
              <span className="hidden text-[#9FB0A6] sm:inline dark:text-[#4D6658]" aria-hidden="true">
                /
              </span>
              <span className="truncate font-semibold text-[#122B1E] dark:text-[#EDF4EF]">
                {t(PAGE_LABEL_MAP[activePage])}
              </span>
              <span className="hidden text-[#9FB0A6] md:inline dark:text-[#4D6658]" aria-hidden="true">
                ·
              </span>
              <span className="hidden text-xs font-medium text-[#8B5A2B] md:inline dark:text-[#E5B87B]">
                {t('demo_mode_short')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleLanguage}
              aria-label={language === 'en' ? 'Switch language to Tamil' : 'Switch language to English'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4DCD5] bg-white px-3 py-1.5 text-xs font-semibold text-[#153625] transition-colors hover:bg-[#EDF2EE] dark:border-[#24382C] dark:bg-[#132119] dark:text-[#DCEEE3] dark:hover:bg-[#1A2D22] whitespace-nowrap shrink-0"
            >
              <Globe className="h-3.5 w-3.5 text-[#2E7D4F] dark:text-[#6CD695]" />
              <span>{language === 'en' ? 'தமிழ்' : 'English'}</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#D4DCD5] bg-white text-[#2A4034] transition-colors hover:bg-[#EDF2EE] dark:border-[#24382C] dark:bg-[#132119] dark:text-[#DCEEE3] dark:hover:bg-[#1A2D22] shrink-0"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="mx-auto w-full max-w-[1380px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      {/* Live Toast Feedback */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-5 bottom-5 z-50 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-lg ${
            toast.tone === 'error'
              ? 'border-[#DC2626]/40 bg-[#FEF2F2] text-[#991B1B] dark:bg-[#2A1212] dark:text-[#FCA5A5]'
              : 'border-[#2E7D4F]/35 bg-[#122B1E] text-white dark:bg-[#1D4B33]'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
