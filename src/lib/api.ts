import { mockStore } from './mockStore';
import type {
  AlertItem,
  AppSettings,
  DeviceStatus,
  OverviewResponse,
  RootAnalysisRecord,
  RootHealthFusionResult,
  SensorReading,
} from '../types/rootwatch';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getOverview: async (): Promise<OverviewResponse> => {
    try {
      return await requestJson<OverviewResponse>('/api/overview');
    } catch {
      return mockStore.getOverview();
    }
  },

  getSensors: async (
    range: '24h' | '7d' | '30d' | 'all' = '24h',
  ): Promise<{ range: string; readings: SensorReading[]; fusion: RootHealthFusionResult | null }> => {
    try {
      return await requestJson<{ range: string; readings: SensorReading[]; fusion: RootHealthFusionResult | null }>(
        `/api/sensors?range=${encodeURIComponent(range)}`,
      );
    } catch {
      return mockStore.getSensors(range);
    }
  },

  simulateSensor: async (
    scenario: 'normal' | 'overwatered' | 'dry_stress' | 'salinity_spike' = 'normal',
  ): Promise<{ reading: SensorReading }> => {
    try {
      return await requestJson<{ reading: SensorReading }>('/api/sensors/simulate', {
        method: 'POST',
        body: JSON.stringify({ scenario }),
      });
    } catch {
      return mockStore.simulateSensor(scenario);
    }
  },

  ingestTestPayload: async (payload: {
    deviceId: string;
    moistureShallow: number;
    moistureDeep: number;
    soilTemp: number;
    soilPh: number;
    soilEc: number;
    rootImpedance: number;
    notes?: string;
  }): Promise<{ reading: SensorReading }> => {
    try {
      return await requestJson<{ reading: SensorReading }>('/api/sensors/ingest', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      return mockStore.ingestTestPayload(payload);
    }
  },

  getRootAnalyses: async (): Promise<{ analyses: RootAnalysisRecord[] }> => {
    try {
      return await requestJson<{ analyses: RootAnalysisRecord[] }>('/api/root-analyses');
    } catch {
      return mockStore.getRootAnalyses();
    }
  },

  saveRootAnalysis: async (
    payload: Omit<RootAnalysisRecord, 'id' | 'deviceId' | 'capturedAt'>,
  ): Promise<{ analysis: RootAnalysisRecord }> => {
    try {
      return await requestJson<{ analysis: RootAnalysisRecord }>('/api/root-analyses', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      return mockStore.saveRootAnalysis(payload);
    }
  },

  getAlerts: async (): Promise<{ alerts: AlertItem[] }> => {
    try {
      return await requestJson<{ alerts: AlertItem[] }>('/api/alerts');
    } catch {
      return mockStore.getAlerts();
    }
  },

  acknowledgeAlert: async (id: number): Promise<{ alert: AlertItem }> => {
    try {
      return await requestJson<{ alert: AlertItem }>(`/api/alerts/${id}/acknowledge`, { method: 'PATCH' });
    } catch {
      return mockStore.acknowledgeAlert(id);
    }
  },

  getDevice: async (): Promise<{ device: DeviceStatus }> => {
    try {
      return await requestJson<{ device: DeviceStatus }>('/api/device');
    } catch {
      return mockStore.getDevice();
    }
  },

  updateDevice: async (patch: {
    samplingIntervalMin?: number;
    connectionStatus?: DeviceStatus['connectionStatus'];
    ping?: boolean;
    name?: string;
    location?: string;
  }): Promise<{ device: DeviceStatus }> => {
    try {
      return await requestJson<{ device: DeviceStatus }>('/api/device', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    } catch {
      return mockStore.updateDevice(patch);
    }
  },

  getDataRecords: async (): Promise<{
    sensors: SensorReading[];
    analyses: RootAnalysisRecord[];
    alerts: AlertItem[];
    device: DeviceStatus;
  }> => {
    try {
      return await requestJson<{
        sensors: SensorReading[];
        analyses: RootAnalysisRecord[];
        alerts: AlertItem[];
        device: DeviceStatus;
      }>('/api/data/records');
    } catch {
      return mockStore.getDataRecords();
    }
  },

  getSettings: async (): Promise<{ settings: AppSettings }> => {
    try {
      return await requestJson<{ settings: AppSettings }>('/api/settings');
    } catch {
      return mockStore.getSettings();
    }
  },

  updateSettings: async (patch: Partial<AppSettings>): Promise<{ settings: AppSettings }> => {
    try {
      return await requestJson<{ settings: AppSettings }>('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    } catch {
      return mockStore.updateSettings(patch);
    }
  },

  submitContact: async (payload: {
    name: string;
    email: string;
    farmLocation: string;
    message: string;
  }): Promise<{ inquiry: { id: number } }> => {
    try {
      return await requestJson<{ inquiry: { id: number } }>('/api/contact', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      return mockStore.submitContact(payload);
    }
  },
};
