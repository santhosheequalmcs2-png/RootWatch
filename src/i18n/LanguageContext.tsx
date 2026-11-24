import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DEFAULT_ALERT_THRESHOLDS } from '../lib/analytics';
import { api } from '../lib/api';
import type { AppSettings, Language, ThemeMode } from '../types/rootwatch';
import { translate } from './translations';

interface AppContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  settings: AppSettings;
  updateAppSettings: (patch: Partial<AppSettings>) => Promise<void>;
  t: (key: string) => string;
  refreshTick: number;
  triggerDataRefresh: () => void;
  toast: { message: string; tone: 'info' | 'success' | 'error' } | null;
  showToast: (message: string, tone?: 'info' | 'success' | 'error') => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  theme: 'light',
  demoMode: true,
  fastDemoMode: false,
  autoSimulate: false,
  notifyAlerts: true,
  notifyCalibration: true,
  telegramPlannedEnabled: false,
  samplingIntervalMin: 15,
  calibrationNote: '',
  alertThresholds: { ...DEFAULT_ALERT_THRESHOLDS },
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const savedLang = localStorage.getItem('rw_lang');
    const savedTheme = localStorage.getItem('rw_theme');
    return {
      ...DEFAULT_SETTINGS,
      language: savedLang === 'ta' ? 'ta' : 'en',
      theme: savedTheme === 'dark' ? 'dark' : 'light',
    };
  });
  const [refreshTick, setRefreshTick] = useState(0);
  const [toast, setToast] = useState<{ message: string; tone: 'info' | 'success' | 'error' } | null>(
    null,
  );

  // Sync HTML lang attribute and Tailwind v4 `.dark` class
  useEffect(() => {
    document.documentElement.lang = settings.language;
    localStorage.setItem('rw_lang', settings.language);
  }, [settings.language]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('rw_theme', settings.theme);
  }, [settings.theme]);

  // Hydrate settings from SQLite backend on mount
  useEffect(() => {
    let active = true;
    api
      .getSettings()
      .then(({ settings: remote }) => {
        if (!active) return;
        setSettings((prev) => ({
          ...prev,
          ...remote,
          alertThresholds: {
            ...DEFAULT_ALERT_THRESHOLDS,
            ...(remote.alertThresholds ?? {}),
          },
          // Keep user's immediate localStorage preference if explicitly set in session
          language: (localStorage.getItem('rw_lang') as Language) || remote.language,
          theme: (localStorage.getItem('rw_theme') as ThemeMode) || remote.theme,
        }));
      })
      .catch(() => {
        // Keep local defaults if backend is still starting
      });
    return () => {
      active = false;
    };
  }, []);

  // Optional standard auto-simulation timer when enabled (paused while fast Demo Mode is active)
  useEffect(() => {
    if (!settings.autoSimulate || settings.fastDemoMode) return;
    const id = window.setInterval(() => {
      api
        .simulateSensor('normal')
        .then(() => setRefreshTick((n) => n + 1))
        .catch(() => {});
    }, 30_000);
    return () => window.clearInterval(id);
  }, [settings.autoSimulate, settings.fastDemoMode]);

  const showToast = useCallback(
    (message: string, tone: 'info' | 'success' | 'error' = 'info') => {
      setToast({ message, tone });
    },
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const updateAppSettings = useCallback(async (patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    try {
      const { settings: saved } = await api.updateSettings(patch);
      setSettings(saved);
    } catch {
      // Retain optimistic local state
    }
  }, []);

  const setLanguage = useCallback(
    (language: Language) => {
      void updateAppSettings({ language });
    },
    [updateAppSettings],
  );

  const toggleLanguage = useCallback(() => {
    setLanguage(settings.language === 'en' ? 'ta' : 'en');
  }, [settings.language, setLanguage]);

  const setTheme = useCallback(
    (theme: ThemeMode) => {
      void updateAppSettings({ theme });
    },
    [updateAppSettings],
  );

  const toggleTheme = useCallback(() => {
    setTheme(settings.theme === 'dark' ? 'light' : 'dark');
  }, [settings.theme, setTheme]);

  const t = useCallback((key: string) => translate(settings.language, key), [settings.language]);

  const triggerDataRefresh = useCallback(() => {
    setRefreshTick((n) => n + 1);
  }, []);

  return (
    <AppContext.Provider
      value={{
        language: settings.language,
        setLanguage,
        toggleLanguage,
        theme: settings.theme,
        setTheme,
        toggleTheme,
        settings,
        updateAppSettings,
        t,
        refreshTick,
        triggerDataRefresh,
        toast,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
