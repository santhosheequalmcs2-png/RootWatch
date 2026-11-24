import farmHeroImg from '../assets/images/agritech_field_farm_1795366648033.jpg';
import rootHealthyImg from '../assets/images/root_sample_healthy_1795366637461.jpg';
import rootMildImg from '../assets/images/root_sample_mild_stress_1795366635183.jpg';
import rootElevatedImg from '../assets/images/root_sample_elevated_stress_1795366666365.jpg';

export interface SampleRootImage {
  id: string;
  labelKey: string;
  stageKey: string;
  capturedDate: string;
  imageUrl: string;
  cropName: string;
  notesKey: string;
}

export const FARM_HERO_IMAGE = farmHeroImg;

export const SAMPLE_ROOT_IMAGES: SampleRootImage[] = [
  {
    id: 'sample-healthy',
    labelKey: 'sample_healthy_label',
    stageKey: 'sample_healthy_stage',
    capturedDate: '2026-11-12',
    imageUrl: rootHealthyImg,
    cropName: 'Turmeric / Tomato Trial Plot',
    notesKey: 'sample_healthy_notes',
  },
  {
    id: 'sample-mild',
    labelKey: 'sample_mild_label',
    stageKey: 'sample_mild_stage',
    capturedDate: '2026-11-17',
    imageUrl: rootMildImg,
    cropName: 'Turmeric / Tomato Trial Plot',
    notesKey: 'sample_mild_notes',
  },
  {
    id: 'sample-elevated',
    labelKey: 'sample_elevated_label',
    stageKey: 'sample_elevated_stage',
    capturedDate: '2026-11-21',
    imageUrl: rootElevatedImg,
    cropName: 'Turmeric / Tomato Trial Plot',
    notesKey: 'sample_elevated_notes',
  },
];

export interface DevicePartSpec {
  id: string;
  nameKey: string;
  roleKey: string;
  descKey: string;
  specs: string;
  statusKey: string;
  category: 'compute' | 'optics' | 'sensors' | 'structure';
}

export const DEVICE_PARTS: DevicePartSpec[] = [
  {
    id: 'enclosure',
    nameKey: 'part_enclosure_name',
    roleKey: 'part_enclosure_role',
    descKey: 'part_enclosure_desc',
    specs: 'IP65 UV-stabilized ABS/Aluminum · 145 × 110 × 65 mm',
    statusKey: 'part_status_prototype',
    category: 'structure',
  },
  {
    id: 'esp32',
    nameKey: 'part_esp32_name',
    roleKey: 'part_esp32_role',
    descKey: 'part_esp32_desc',
    specs: 'ESP32-S3 Dual-Core · Wi-Fi / BLE · Deep-Sleep 18 µA',
    statusKey: 'part_status_planned_mqtt',
    category: 'compute',
  },
  {
    id: 'chamber',
    nameKey: 'part_chamber_name',
    roleKey: 'part_chamber_role',
    descKey: 'part_chamber_desc',
    specs: 'Optical Borosilicate / Acrylic Window · 120 × 180 mm',
    statusKey: 'part_status_prototype',
    category: 'optics',
  },
  {
    id: 'roots',
    nameKey: 'part_roots_name',
    roleKey: 'part_roots_role',
    descKey: 'part_roots_desc',
    specs: 'Active Rhizosphere Interface · 0–25 cm Depth Profile',
    statusKey: 'part_status_monitored',
    category: 'optics',
  },
  {
    id: 'camera',
    nameKey: 'part_camera_name',
    roleKey: 'part_camera_role',
    descKey: 'part_camera_desc',
    specs: 'OV5640 5MP Macro Autofocus · Fixed Focal Distance 85 mm',
    statusKey: 'part_status_prototype',
    category: 'optics',
  },
  {
    id: 'leds',
    nameKey: 'part_leds_name',
    roleKey: 'part_leds_role',
    descKey: 'part_leds_desc',
    specs: '5500K CRI-95 Diffused White Ring + 850nm NIR Aux',
    statusKey: 'part_status_prototype',
    category: 'optics',
  },
  {
    id: 'moisture_probes',
    nameKey: 'part_moisture_name',
    roleKey: 'part_moisture_role',
    descKey: 'part_moisture_desc',
    specs: 'Dual-Depth Capacitive Probes · 10 cm & 25 cm · Corrosion-Resistant',
    statusKey: 'part_status_simulated',
    category: 'sensors',
  },
  {
    id: 'temp_sensor',
    nameKey: 'part_temp_name',
    roleKey: 'part_temp_role',
    descKey: 'part_temp_desc',
    specs: 'Stainless DS18B20 Digital Probe · ±0.5 °C · 1-Wire Bus',
    statusKey: 'part_status_simulated',
    category: 'sensors',
  },
  {
    id: 'ec_sensor',
    nameKey: 'part_ec_name',
    roleKey: 'part_ec_role',
    descKey: 'part_ec_desc',
    specs: 'Titanium-Graphite 2-Electrode Cell · 0–10 mS/cm · Temp-Comp',
    statusKey: 'part_status_simulated',
    category: 'sensors',
  },
  {
    id: 'ph_sensor',
    nameKey: 'part_ph_name',
    roleKey: 'part_ph_role',
    descKey: 'part_ph_desc',
    specs: 'Solid-State Soil pH Glass Bulb · pH 3.0–10.0 · Perforated Guard',
    statusKey: 'part_status_simulated',
    category: 'sensors',
  },
  {
    id: 'impedance',
    nameKey: 'part_impedance_name',
    roleKey: 'part_impedance_role',
    descKey: 'part_impedance_desc',
    specs: 'Twin Stainless Bio-Impedance Pins · 1 kHz–50 kHz Sweep (R&D)',
    statusKey: 'part_status_experimental',
    category: 'sensors',
  },
  {
    id: 'cables',
    nameKey: 'part_cables_name',
    roleKey: 'part_cables_role',
    descKey: 'part_cables_desc',
    specs: 'Shielded UV-Rated Conduits · PG9 Waterproof Compression Glands',
    statusKey: 'part_status_prototype',
    category: 'structure',
  },
  {
    id: 'mounting',
    nameKey: 'part_mounting_name',
    roleKey: 'part_mounting_role',
    descKey: 'part_mounting_desc',
    specs: '304 Stainless Field Stake + Adjustable Collar Clamp · 65 cm',
    statusKey: 'part_status_prototype',
    category: 'structure',
  },
];
