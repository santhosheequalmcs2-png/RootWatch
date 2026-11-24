import type { ComponentId } from './componentsData';

export type TimeframeKey = '24h' | '7d';

export interface SensorDataPoint {
  index: number;
  label: string;
  value: number;
}

export interface SensorSeriesProfile {
  componentId: ComponentId;
  metricName: string;
  unit: string;
  decimals: number;
  domain: [number, number];
  referenceBand?: {
    min: number;
    max: number;
    label: string;
  };
  experimental?: boolean;
  caption: string;
  series: Record<TimeframeKey, SensorDataPoint[]>;
}

const HOURS_24 = [
  '00:00',
  '02:00',
  '04:00',
  '06:00',
  '08:00',
  '10:00',
  '12:00',
  '14:00',
  '16:00',
  '18:00',
  '20:00',
  '22:00',
  '24:00',
];

const DAYS_7 = [
  'Day 1',
  'Day 1 PM',
  'Day 2',
  'Day 2 PM',
  'Day 3',
  'Day 3 PM',
  'Day 4',
  'Day 4 PM',
  'Day 5',
  'Day 5 PM',
  'Day 6',
  'Day 6 PM',
  'Day 7',
];

function buildPoints(labels: string[], values: number[]): SensorDataPoint[] {
  return labels.map((label, index) => ({
    index,
    label,
    value: values[index],
  }));
}

export const SENSOR_HISTORY_PROFILES: Partial<Record<ComponentId, SensorSeriesProfile>> = {
  'moisture-1': {
    componentId: 'moisture-1',
    metricName: 'Shallow Soil Moisture',
    unit: '% VWC',
    decimals: 1,
    domain: [15, 55],
    referenceBand: {
      min: 28,
      max: 42,
      label: 'Target zone',
    },
    caption: 'Irrigation pulse at 06:00 followed by rapid shallow evapotranspiration.',
    series: {
      '24h': buildPoints(
        HOURS_24,
        [29.4, 28.9, 28.4, 43.8, 42.1, 39.6, 36.8, 34.2, 32.5, 31.6, 31.0, 30.5, 30.1],
      ),
      '7d': buildPoints(
        DAYS_7,
        [41.2, 35.4, 31.1, 27.6, 44.0, 38.2, 33.8, 30.2, 26.8, 43.4, 37.5, 33.1, 30.1],
      ),
    },
  },
  'moisture-2': {
    componentId: 'moisture-2',
    metricName: 'Deep Soil Moisture',
    unit: '% VWC',
    decimals: 1,
    domain: [15, 55],
    referenceBand: {
      min: 30,
      max: 44,
      label: 'Target zone',
    },
    caption: 'Delayed percolation response and steadier moisture retention at 16–22 cm depth.',
    series: {
      '24h': buildPoints(
        HOURS_24,
        [34.2, 34.0, 33.8, 34.4, 37.9, 40.6, 40.8, 39.9, 39.1, 38.5, 38.1, 37.8, 37.5],
      ),
      '7d': buildPoints(
        DAYS_7,
        [38.8, 37.4, 35.9, 34.3, 39.4, 40.5, 38.9, 37.1, 35.2, 39.8, 40.4, 38.6, 37.5],
      ),
    },
  },
  'temp-sensor': {
    componentId: 'temp-sensor',
    metricName: 'Root-Zone Temperature',
    unit: '°C',
    decimals: 1,
    domain: [14, 28],
    referenceBand: {
      min: 18,
      max: 24,
      label: 'Optimal band',
    },
    caption: 'Buffered diurnal thermal cycle lagging ambient afternoon highs.',
    series: {
      '24h': buildPoints(
        HOURS_24,
        [19.4, 18.9, 18.5, 18.4, 19.0, 20.3, 21.8, 23.0, 23.5, 22.9, 21.8, 20.7, 19.9],
      ),
      '7d': buildPoints(
        DAYS_7,
        [18.6, 22.4, 18.9, 23.1, 19.2, 23.8, 19.8, 24.1, 19.1, 22.6, 18.5, 22.8, 19.9],
      ),
    },
  },
  'ec-sensor': {
    componentId: 'ec-sensor',
    metricName: 'Electrical Conductivity',
    unit: 'mS/cm',
    decimals: 2,
    domain: [0.6, 2.4],
    referenceBand: {
      min: 1.2,
      max: 1.8,
      label: 'Nominal EC',
    },
    caption: 'Dissolved ion conductivity rising briefly after morning nutrient irrigation.',
    series: {
      '24h': buildPoints(
        HOURS_24,
        [1.38, 1.37, 1.36, 1.62, 1.74, 1.71, 1.66, 1.61, 1.58, 1.55, 1.53, 1.51, 1.5],
      ),
      '7d': buildPoints(
        DAYS_7,
        [1.46, 1.42, 1.38, 1.35, 1.72, 1.64, 1.56, 1.49, 1.41, 1.69, 1.61, 1.54, 1.5],
      ),
    },
  },
  'ph-sensor': {
    componentId: 'ph-sensor',
    metricName: 'Soil Solution pH',
    unit: 'pH',
    decimals: 2,
    domain: [5.4, 7.6],
    referenceBand: {
      min: 6.0,
      max: 6.8,
      label: 'Optimal pH',
    },
    caption: 'Stable rhizosphere acidity with minor diurnal drift during nutrient uptake.',
    series: {
      '24h': buildPoints(
        HOURS_24,
        [6.48, 6.49, 6.5, 6.46, 6.42, 6.44, 6.49, 6.55, 6.58, 6.56, 6.53, 6.51, 6.5],
      ),
      '7d': buildPoints(
        DAYS_7,
        [6.54, 6.59, 6.52, 6.57, 6.44, 6.51, 6.49, 6.55, 6.48, 6.43, 6.5, 6.54, 6.5],
      ),
    },
  },
  impedance: {
    componentId: 'impedance',
    metricName: 'Impedance Magnitude (10 kHz)',
    unit: 'kΩ',
    decimals: 1,
    domain: [8, 20],
    experimental: true,
    caption: 'Simulated exploratory impedance trace responding to combined soil-water conditions.',
    series: {
      '24h': buildPoints(
        HOURS_24,
        [14.9, 15.1, 15.2, 12.1, 11.7, 12.0, 12.5, 13.0, 13.4, 13.7, 13.9, 14.1, 14.2],
      ),
      '7d': buildPoints(
        DAYS_7,
        [12.4, 13.6, 14.5, 15.4, 11.8, 12.9, 13.8, 14.6, 15.3, 12.0, 13.1, 13.8, 14.2],
      ),
    },
  },
};

export function hasSensorHistory(id: ComponentId): boolean {
  return Boolean(SENSOR_HISTORY_PROFILES[id]);
}
