export type ComponentId =
  | 'enclosure'
  | 'esp32'
  | 'root-chamber'
  | 'root-system'
  | 'camera'
  | 'leds'
  | 'moisture-1'
  | 'moisture-2'
  | 'temp-sensor'
  | 'ec-sensor'
  | 'ph-sensor'
  | 'impedance';

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

export interface ComponentSpec {
  id: ComponentId;
  name: string;
  shortLabel: string;
  category: 'Electronics' | 'Observation' | 'Soil Sensing' | 'Experimental';
  location: string;
  summary: string;
  purpose: string;
  contribution: string;
  experimental?: boolean;
  showDefaultLabel: boolean;
  focusPose: CameraPose;
}

export const DEFAULT_CAMERA_POSE: CameraPose = {
  position: [3.4, 3.0, 6.2],
  target: [-0.35, 1.55, 0.25],
};

export const EXPLODED_CAMERA_POSE: CameraPose = {
  position: [4.6, 3.55, 7.6],
  target: [-0.4, 1.65, 0.3],
};

export const COMPONENT_SPECS: Record<ComponentId, ComponentSpec> = {
  enclosure: {
    id: 'enclosure',
    name: 'Electronics Enclosure',
    shortLabel: 'Enclosure',
    category: 'Electronics',
    location: 'Left vertical mounting mast, IP65 sealed side housing',
    summary:
      'Weather-resistant field enclosure engineered to shield sensitive signal-conditioning electronics and the ESP32 controller from irrigation spray, humidity, and greenhouse dust.',
    purpose:
      'Houses the microcontroller and sensor interface boards while routing probe leads through sealed waterproof PG7 cable glands.',
    contribution:
      'Enables reliable multi-week deployment in soil and greenhouse environments without corrosion or moisture ingress interrupting root-zone logging.',
    showDefaultLabel: false,
    focusPose: {
      position: [-3.9, 2.3, 3.7],
      target: [-2.15, 1.85, 0.0],
    },
  },
  esp32: {
    id: 'esp32',
    name: 'ESP32 Controller',
    shortLabel: 'ESP32',
    category: 'Electronics',
    location: 'Mounted on brass standoffs inside the electronics enclosure',
    summary:
      'Dual-core Wi-Fi and Bluetooth microcontroller board equipped with onboard ADC channels, I2C/SPI buses, PCB trace antenna, and external SMA antenna port.',
    purpose:
      'Collects data from connected soil sensors, controls LED illumination timing, triggers root imaging intervals, and transmits telemetry to the monitoring system.',
    contribution:
      'Acts as the central acquisition and communication hub of RootWatch, synchronizing environmental measurements with visual root observations over time.',
    showDefaultLabel: true,
    focusPose: {
      position: [-3.2, 2.25, 2.95],
      target: [-2.15, 1.85, 0.25],
    },
  },
  'root-chamber': {
    id: 'root-chamber',
    name: 'Root Observation Chamber',
    shortLabel: 'Root observation chamber',
    category: 'Observation',
    location: 'Central anodized support frame with front acrylic window',
    summary:
      'Transparent acrylic rhizobox chamber filled with layered agricultural substrate, engineered with a rigid extruded aluminum frame and depth-graduated observation window.',
    purpose:
      'Contains the crop soil profile and guides developing roots along a clear optical viewing plane without disturbing the plant.',
    contribution:
      'Provides non-destructive visual access to the rhizosphere alongside co-located soil probes so physical root behavior can be compared against sensor trends.',
    showDefaultLabel: true,
    focusPose: {
      position: [2.3, 2.05, 4.4],
      target: [0.35, 1.5, 0.15],
    },
  },
  'root-system': {
    id: 'root-system',
    name: 'Root System',
    shortLabel: 'Root system',
    category: 'Observation',
    location: 'Extending downward inside the soil behind the acrylic window',
    summary:
      'Living crop root architecture featuring a primary taproot, lateral branching roots, and fine tertiary root hairs growing downward through the soil profile.',
    purpose:
      'Serves as the biological target of observation for tracking elongation, branching density, coloration changes, and spatial response to moisture or salinity.',
    contribution:
      'Provides direct visual morphology cues that complement numerical soil metrics when evaluating early signs of water deficit, aeration stress, or nutrient imbalance.',
    showDefaultLabel: false,
    focusPose: {
      position: [0.45, 1.55, 3.05],
      target: [0.35, 1.4, 0.35],
    },
  },
  camera: {
    id: 'camera',
    name: 'Root Camera',
    shortLabel: 'Root camera',
    category: 'Observation',
    location: 'Forward anodized optical bridge rail facing the rhizobox window',
    summary:
      'Compact macro-capable imaging module with a machined aluminum barrel, multi-element glass lens, and adjustable gimbal mount aligned perpendicular to the chamber window.',
    purpose:
      'Captures periodic images of roots visible through the transparent observation chamber so root growth and visible surface changes can be tracked across days.',
    contribution:
      'Delivers time-series visual records of root architecture and coloration that can support downstream growth tracking and stress assessment.',
    showDefaultLabel: true,
    focusPose: {
      position: [1.95, 1.75, 3.45],
      target: [0.35, 1.48, 1.48],
    },
  },
  leds: {
    id: 'leds',
    name: 'LED Illumination',
    shortLabel: 'LEDs',
    category: 'Observation',
    location: 'Dual angled light bars flanking the root camera on the optical rail',
    summary:
      'Symmetrical twin-bar full-spectrum SMD LED illumination modules angled inward across the observation glass to minimize specular glare.',
    purpose:
      'Provides consistent, repeatable illumination strictly during camera capture intervals while keeping the root zone dark between snapshots.',
    contribution:
      'Standardizes lighting exposure across day and night captures so subtle root color shifts and fine root tips remain clearly distinguishable.',
    showDefaultLabel: true,
    focusPose: {
      position: [-1.15, 1.85, 3.55],
      target: [0.35, 1.48, 1.38],
    },
  },
  'moisture-1': {
    id: 'moisture-1',
    name: 'Moisture Sensor 1 (Shallow)',
    shortLabel: 'Moisture sensor 1',
    category: 'Soil Sensing',
    location: 'Upper topsoil root zone (5–10 cm depth, center-left)',
    summary:
      'Capacitive dual-prong soil moisture probe positioned in the upper active root horizon to track rapid irrigation infiltration and surface drying.',
    purpose:
      'Measures volumetric water conditions in the shallow root zone where evaporation and initial water uptake occur fastest.',
    contribution:
      'Paired with the deeper probe, it helps reveal vertical moisture gradients and indicates when irrigation water first reaches upper lateral roots.',
    showDefaultLabel: true,
    focusPose: {
      position: [-0.85, 2.75, 2.9],
      target: [0.02, 2.15, 0.2],
    },
  },
  'moisture-2': {
    id: 'moisture-2',
    name: 'Moisture Sensor 2 (Deep)',
    shortLabel: 'Moisture sensor 2',
    category: 'Soil Sensing',
    location: 'Lower subsoil root zone (16–22 cm depth, right side)',
    summary:
      'Extended-shaft deep-zone soil moisture probe reaching the lower chamber horizon to monitor percolation and deep water reserves.',
    purpose:
      'Measures soil moisture at deeper root levels to verify whether irrigation penetrates to the taproot or drains past the active root zone.',
    contribution:
      'Enables two-depth moisture profiling so RootWatch can distinguish shallow surface dryness from whole-profile water depletion.',
    showDefaultLabel: true,
    focusPose: {
      position: [2.55, 1.95, 2.85],
      target: [1.18, 1.4, 0.1],
    },
  },
  'temp-sensor': {
    id: 'temp-sensor',
    name: 'Soil Temperature Sensor',
    shortLabel: 'Temperature probe',
    category: 'Soil Sensing',
    location: 'Mid-depth root zone (left side of observation chamber)',
    summary:
      'Waterproof 316L stainless-steel digital temperature probe embedded directly within the active root zone.',
    purpose:
      'Monitors soil temperature near the roots and provides thermal reference values for temperature-sensitive chemical and electrical measurements.',
    contribution:
      'Tracks root-zone thermal conditions that govern metabolic activity while supplying temperature compensation data for EC and pH readings.',
    showDefaultLabel: true,
    focusPose: {
      position: [-1.45, 2.25, 2.85],
      target: [-0.45, 1.8, 0.22],
    },
  },
  'ec-sensor': {
    id: 'ec-sensor',
    name: 'EC Sensor',
    shortLabel: 'EC sensor',
    category: 'Soil Sensing',
    location: 'Mid-right soil zone near lateral root branches',
    summary:
      'Industrial electrical conductivity probe featuring a protective slotted shroud around dual corrosion-resistant sensing electrodes.',
    purpose:
      'Measures bulk electrical conductivity of the soil solution, which can help indicate the concentration of dissolved ions and fertilizer salts.',
    contribution:
      'Helps identify potential salinity buildup or nutrient depletion around the roots when interpreted alongside moisture and temperature trends.',
    showDefaultLabel: true,
    focusPose: {
      position: [2.15, 2.25, 2.75],
      target: [0.85, 1.85, 0.24],
    },
  },
  'ph-sensor': {
    id: 'ph-sensor',
    name: 'pH Sensor',
    shortLabel: 'pH sensor',
    category: 'Soil Sensing',
    location: 'Mid-left rear soil column beside primary root zone',
    summary:
      'Soil-compatible glass-bulb pH electrode with a porous reference junction and protective spear guard designed for moist agricultural substrates.',
    purpose:
      'Measures soil solution acidity or alkalinity in the immediate rhizosphere environment.',
    contribution:
      'Monitors pH stability because shifts outside optimal ranges can limit nutrient availability and contribute to observable root stress.',
    showDefaultLabel: true,
    focusPose: {
      position: [-1.35, 2.35, 2.55],
      target: [-0.22, 1.65, -0.04],
    },
  },
  impedance: {
    id: 'impedance',
    name: 'Impedance Electrodes',
    shortLabel: 'Impedance electrodes',
    category: 'Experimental',
    location: 'Paired copper-gold rods bracketing the central root zone',
    summary:
      'Experimental dual-electrode sensing pair with isolated ceramic collars and differential leads positioned across the root-soil cross section.',
    purpose:
      'Experimental sensing component intended to investigate electrical impedance properties associated with root-zone conditions across test frequencies.',
    contribution:
      'Supports exploratory research into non-invasive electrical signatures of the soil-root interface. Readings are experimental and are not claimed to directly measure root mass without controlled calibration and validation.',
    experimental: true,
    showDefaultLabel: true,
    focusPose: {
      position: [1.45, 2.3, 2.85],
      target: [0.38, 1.75, 0.14],
    },
  },
};

export const COMPONENT_ORDER: ComponentId[] = [
  'enclosure',
  'esp32',
  'root-chamber',
  'root-system',
  'camera',
  'leds',
  'moisture-1',
  'moisture-2',
  'temp-sensor',
  'ec-sensor',
  'ph-sensor',
  'impedance',
];

export interface DemoStep {
  stepNumber: number;
  title: string;
  description: string;
  highlightedComponents: ComponentId[];
  primaryComponent: ComponentId | null;
  cameraPose: CameraPose;
  exploded: boolean;
  lidOpenFactor: number;
  ledBoost: number;
  durationMs: number;
}

export const DEMO_STEPS: DemoStep[] = [
  {
    stepNumber: 1,
    title: 'RootWatch Prototype Overview',
    description:
      'RootWatch integrates a transparent rhizobox observation chamber, multi-depth soil probes, optical imaging, and an ESP32 telemetry enclosure into one unified root-zone monitoring prototype.',
    highlightedComponents: [],
    primaryComponent: null,
    cameraPose: {
      position: [3.6, 3.05, 6.2],
      target: [-0.35, 1.55, 0.25],
    },
    exploded: false,
    lidOpenFactor: 0,
    ledBoost: 0.35,
    durationMs: 6500,
  },
  {
    stepNumber: 2,
    title: 'Multi-Depth Soil Moisture Probes',
    description:
      'Two soil moisture sensors are positioned at distinct depths: Moisture Sensor 1 in the shallow topsoil horizon and Moisture Sensor 2 deep in the lower subsoil zone.',
    highlightedComponents: ['moisture-1', 'moisture-2'],
    primaryComponent: 'moisture-1',
    cameraPose: {
      position: [2.1, 2.95, 4.1],
      target: [0.55, 1.85, 0.15],
    },
    exploded: false,
    lidOpenFactor: 0,
    ledBoost: 0.2,
    durationMs: 6500,
  },
  {
    stepNumber: 3,
    title: 'Tracking Vertical Moisture Movement',
    description:
      'Comparing shallow and deep probe readings helps track how irrigation water infiltrates downward, reveals vertical moisture gradients, and flags rapid drying around active roots.',
    highlightedComponents: ['moisture-1', 'moisture-2', 'root-system'],
    primaryComponent: 'moisture-2',
    cameraPose: {
      position: [2.9, 1.85, 3.6],
      target: [0.65, 1.35, 0.18],
    },
    exploded: false,
    lidOpenFactor: 0,
    ledBoost: 0.3,
    durationMs: 7000,
  },
  {
    stepNumber: 4,
    title: 'Soil Temperature & Electrical Conductivity',
    description:
      'The stainless-steel temperature probe monitors root-zone thermal conditions, while the EC sensor measures electrical conductivity to help indicate dissolved ion and fertilizer concentrations.',
    highlightedComponents: ['temp-sensor', 'ec-sensor'],
    primaryComponent: 'ec-sensor',
    cameraPose: {
      position: [0.35, 2.75, 4.05],
      target: [0.22, 1.85, 0.22],
    },
    exploded: false,
    lidOpenFactor: 0,
    ledBoost: 0.2,
    durationMs: 7000,
  },
  {
    stepNumber: 5,
    title: 'Soil Solution pH Sensing',
    description:
      'A spear-guarded glass-bulb pH electrode monitors soil solution acidity or alkalinity near the rhizosphere, where pH stability strongly influences nutrient availability.',
    highlightedComponents: ['ph-sensor'],
    primaryComponent: 'ph-sensor',
    cameraPose: {
      position: [-1.55, 2.5, 3.1],
      target: [-0.22, 1.7, -0.02],
    },
    exploded: false,
    lidOpenFactor: 0,
    ledBoost: 0.2,
    durationMs: 6500,
  },
  {
    stepNumber: 6,
    title: 'Experimental Impedance Electrodes',
    description:
      'Paired copper-gold electrodes form an experimental sensing subsystem designed to investigate electrical impedance properties in the root zone, without assuming direct root mass measurement prior to validation.',
    highlightedComponents: ['impedance'],
    primaryComponent: 'impedance',
    cameraPose: {
      position: [1.5, 2.45, 3.25],
      target: [0.35, 1.75, 0.14],
    },
    exploded: false,
    lidOpenFactor: 0,
    ledBoost: 0.25,
    durationMs: 7500,
  },
  {
    stepNumber: 7,
    title: 'Root Camera & Cross-Polarized LEDs',
    description:
      'Mounted on the forward optical rail, the macro root camera pairs with twin angled LED bars to illuminate the acrylic window evenly during scheduled image captures.',
    highlightedComponents: ['camera', 'leds'],
    primaryComponent: 'camera',
    cameraPose: {
      position: [2.25, 1.85, 3.8],
      target: [0.35, 1.48, 1.35],
    },
    exploded: false,
    lidOpenFactor: 0,
    ledBoost: 1.0,
    durationMs: 7000,
  },
  {
    stepNumber: 8,
    title: 'Direct Root Observation Window',
    description:
      'Through the crystal-clear acrylic rhizobox window, the camera inspects branching root growth, elongation depth, and visible morphological changes directly inside the soil profile.',
    highlightedComponents: ['root-system', 'root-chamber'],
    primaryComponent: 'root-system',
    cameraPose: {
      position: [0.55, 1.5, 3.15],
      target: [0.35, 1.38, 0.38],
    },
    exploded: false,
    lidOpenFactor: 0,
    ledBoost: 0.85,
    durationMs: 7000,
  },
  {
    stepNumber: 9,
    title: 'ESP32 Data Acquisition & Telemetry',
    description:
      'Inside the weather-resistant enclosure, the ESP32 microcontroller samples all connected probes, triggers imaging illumination, and streams structured telemetry to the monitoring platform.',
    highlightedComponents: ['esp32', 'enclosure'],
    primaryComponent: 'esp32',
    cameraPose: {
      position: [-3.35, 2.25, 3.35],
      target: [-2.15, 1.85, 0.2],
    },
    exploded: false,
    lidOpenFactor: 1,
    ledBoost: 0.2,
    durationMs: 7500,
  },
  {
    stepNumber: 10,
    title: 'Combined Sensor & Visual Stress Assessment',
    description:
      'By aligning multi-depth moisture, temperature, EC, pH, and experimental impedance readings with periodic root imagery, RootWatch provides richer context to support potential root stress assessment.',
    highlightedComponents: [
      'esp32',
      'root-system',
      'camera',
      'moisture-1',
      'moisture-2',
      'ec-sensor',
      'ph-sensor',
    ],
    primaryComponent: null,
    cameraPose: {
      position: [4.5, 3.4, 7.2],
      target: [-0.35, 1.65, 0.3],
    },
    exploded: true,
    lidOpenFactor: 1,
    ledBoost: 0.65,
    durationMs: 8500,
  },
];
