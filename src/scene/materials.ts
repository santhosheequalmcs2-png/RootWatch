import * as THREE from 'three';
import type { ProceduralTextureSet } from './textures';

export interface DeviceMaterialLibrary {
  anodizedFrame: THREE.MeshStandardMaterial;
  enclosureBody: THREE.MeshStandardMaterial;
  enclosureLid: THREE.MeshStandardMaterial;
  rubberGasket: THREE.MeshStandardMaterial;
  stainlessSteel: THREE.MeshStandardMaterial;
  brassHardware: THREE.MeshStandardMaterial;
  copperElectrode: THREE.MeshStandardMaterial;
  goldPin: THREE.MeshStandardMaterial;
  acrylicWindow: THREE.MeshPhysicalMaterial;
  acrylicSide: THREE.MeshPhysicalMaterial;
  lidWindow: THREE.MeshPhysicalMaterial;
  rulerDecal: THREE.MeshBasicMaterial;
  chamberBackplate: THREE.MeshStandardMaterial;
  soilBody: THREE.MeshStandardMaterial;
  rootPrimary: THREE.MeshStandardMaterial;
  rootFine: THREE.MeshStandardMaterial;
  plantLeaf: THREE.MeshStandardMaterial;
  plantStem: THREE.MeshStandardMaterial;
  pcbBoard: THREE.MeshStandardMaterial;
  rfShield: THREE.MeshStandardMaterial;
  darkPolymer: THREE.MeshStandardMaterial;
  cameraBody: THREE.MeshStandardMaterial;
  opticalLens: THREE.MeshPhysicalMaterial;
  ledHousing: THREE.MeshStandardMaterial;
  ledEmitter: THREE.MeshStandardMaterial;
  ledBeam: THREE.MeshBasicMaterial;
  moistureHead: THREE.MeshStandardMaterial;
  moistureDeepHead: THREE.MeshStandardMaterial;
  moistureBlade: THREE.MeshStandardMaterial;
  ecBody: THREE.MeshStandardMaterial;
  ecAccent: THREE.MeshStandardMaterial;
  phBody: THREE.MeshStandardMaterial;
  phAccent: THREE.MeshStandardMaterial;
  phGlassBulb: THREE.MeshPhysicalMaterial;
  impedanceCollar: THREE.MeshStandardMaterial;
  cableJacket: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function createDeviceMaterials(
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean,
): DeviceMaterialLibrary {
  const anodizedFrame = new THREE.MeshStandardMaterial({
    color: 0x1e2623,
    metalness: 0.78,
    roughness: 0.34,
    roughnessMap: textures.brushedMetalRoughness,
  });

  const enclosureBody = new THREE.MeshStandardMaterial({
    color: 0x1a2e24,
    metalness: 0.14,
    roughness: 0.68,
    bumpMap: textures.enclosureGrainBump,
    bumpScale: 0.008,
  });

  const enclosureLid = new THREE.MeshStandardMaterial({
    color: 0x20372c,
    metalness: 0.18,
    roughness: 0.56,
    bumpMap: textures.enclosureGrainBump,
    bumpScale: 0.006,
  });

  const rubberGasket = new THREE.MeshStandardMaterial({
    color: 0x121514,
    metalness: 0.0,
    roughness: 0.9,
  });

  const stainlessSteel = new THREE.MeshStandardMaterial({
    color: 0xd8e0dc,
    metalness: 0.92,
    roughness: 0.2,
    roughnessMap: textures.brushedMetalRoughness,
  });

  const brassHardware = new THREE.MeshStandardMaterial({
    color: 0xc8a258,
    metalness: 0.88,
    roughness: 0.28,
  });

  const copperElectrode = new THREE.MeshStandardMaterial({
    color: 0xc97b4b,
    metalness: 0.9,
    roughness: 0.24,
  });

  const goldPin = new THREE.MeshStandardMaterial({
    color: 0xdcb450,
    metalness: 0.94,
    roughness: 0.18,
  });

  // Crystal-clear acrylic front viewing pane (software-GL safe transmission fallback)
  const acrylicWindow = new THREE.MeshPhysicalMaterial({
    color: 0xeaf6ee,
    metalness: 0.0,
    roughness: 0.06,
    transmission: isSoftwareGl ? 0 : 0.86,
    transparent: true,
    opacity: isSoftwareGl ? 0.16 : 0.95,
    ior: 1.49,
    thickness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    depthWrite: false,
  });

  const acrylicSide = new THREE.MeshPhysicalMaterial({
    color: 0xdaf0e2,
    metalness: 0.0,
    roughness: 0.1,
    transmission: isSoftwareGl ? 0 : 0.72,
    transparent: true,
    opacity: isSoftwareGl ? 0.22 : 0.85,
    ior: 1.49,
    thickness: 0.12,
    clearcoat: 0.8,
    depthWrite: false,
  });

  const lidWindow = new THREE.MeshPhysicalMaterial({
    color: 0xdff2e6,
    metalness: 0.0,
    roughness: 0.08,
    transmission: isSoftwareGl ? 0 : 0.82,
    transparent: true,
    opacity: isSoftwareGl ? 0.2 : 0.92,
    ior: 1.49,
    thickness: 0.08,
    clearcoat: 1.0,
    depthWrite: false,
  });

  const rulerDecal = new THREE.MeshBasicMaterial({
    map: textures.rulerOverlay,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const chamberBackplate = new THREE.MeshStandardMaterial({
    color: 0x151e1a,
    metalness: 0.28,
    roughness: 0.76,
  });

  const soilBody = new THREE.MeshStandardMaterial({
    map: textures.soilAlbedo,
    bumpMap: textures.soilBump,
    bumpScale: 0.032,
    roughness: 0.94,
    metalness: 0.02,
  });

  const rootPrimary = new THREE.MeshStandardMaterial({
    color: 0xdfd3b4,
    roughness: 0.72,
    metalness: 0.0,
    emissive: 0x1c170d,
    emissiveIntensity: 0.18,
  });

  const rootFine = new THREE.MeshStandardMaterial({
    color: 0xece3ca,
    roughness: 0.66,
    metalness: 0.0,
    emissive: 0x221d12,
    emissiveIntensity: 0.22,
  });

  const plantLeaf = new THREE.MeshStandardMaterial({
    color: 0x3b7a4f,
    roughness: 0.52,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const plantStem = new THREE.MeshStandardMaterial({
    color: 0x4c8754,
    roughness: 0.62,
    metalness: 0.0,
  });

  const pcbBoard = new THREE.MeshStandardMaterial({
    map: textures.pcbAlbedo,
    roughnessMap: textures.pcbRoughness,
    roughness: 0.55,
    metalness: 0.2,
  });

  const rfShield = new THREE.MeshStandardMaterial({
    color: 0xcfd6d2,
    metalness: 0.9,
    roughness: 0.22,
    roughnessMap: textures.brushedMetalRoughness,
  });

  const darkPolymer = new THREE.MeshStandardMaterial({
    color: 0x1a1e1d,
    metalness: 0.06,
    roughness: 0.64,
  });

  const cameraBody = new THREE.MeshStandardMaterial({
    color: 0x242c29,
    metalness: 0.72,
    roughness: 0.32,
  });

  const opticalLens = new THREE.MeshPhysicalMaterial({
    color: 0x1a4a5e,
    metalness: 0.12,
    roughness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    ior: 1.76,
    reflectivity: 1.0,
  });

  const ledHousing = new THREE.MeshStandardMaterial({
    color: 0x27332e,
    metalness: 0.68,
    roughness: 0.35,
  });

  const ledEmitter = new THREE.MeshStandardMaterial({
    color: 0xfff8e8,
    emissive: 0xe6ffe8,
    emissiveIntensity: 1.4,
    roughness: 0.2,
    metalness: 0.0,
  });

  const ledBeam = new THREE.MeshBasicMaterial({
    color: 0xdffce8,
    alphaMap: textures.ledBeamAlpha,
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const moistureHead = new THREE.MeshStandardMaterial({
    color: 0x245c44,
    metalness: 0.08,
    roughness: 0.45,
  });

  const moistureDeepHead = new THREE.MeshStandardMaterial({
    color: 0x1d4d3e,
    metalness: 0.12,
    roughness: 0.42,
  });

  const moistureBlade = new THREE.MeshStandardMaterial({
    color: 0x2b3632,
    metalness: 0.6,
    roughness: 0.34,
  });

  const ecBody = new THREE.MeshStandardMaterial({
    color: 0x252d30,
    metalness: 0.12,
    roughness: 0.48,
  });

  const ecAccent = new THREE.MeshStandardMaterial({
    color: 0x4da89b,
    metalness: 0.25,
    roughness: 0.36,
  });

  const phBody = new THREE.MeshStandardMaterial({
    color: 0x2c2a27,
    metalness: 0.1,
    roughness: 0.5,
  });

  const phAccent = new THREE.MeshStandardMaterial({
    color: 0x6ba368,
    metalness: 0.2,
    roughness: 0.38,
  });

  const phGlassBulb = new THREE.MeshPhysicalMaterial({
    color: 0x9bd6c8,
    metalness: 0.0,
    roughness: 0.08,
    transmission: isSoftwareGl ? 0 : 0.72,
    transparent: true,
    opacity: isSoftwareGl ? 0.52 : 0.95,
    ior: 1.52,
    clearcoat: 1.0,
  });

  const impedanceCollar = new THREE.MeshStandardMaterial({
    color: 0xc98a32,
    metalness: 0.18,
    roughness: 0.4,
  });

  const cableJacket = new THREE.MeshStandardMaterial({
    color: 0x171b19,
    metalness: 0.04,
    roughness: 0.78,
  });

  const allMaterials = [
    anodizedFrame,
    enclosureBody,
    enclosureLid,
    rubberGasket,
    stainlessSteel,
    brassHardware,
    copperElectrode,
    goldPin,
    acrylicWindow,
    acrylicSide,
    lidWindow,
    rulerDecal,
    chamberBackplate,
    soilBody,
    rootPrimary,
    rootFine,
    plantLeaf,
    plantStem,
    pcbBoard,
    rfShield,
    darkPolymer,
    cameraBody,
    opticalLens,
    ledHousing,
    ledEmitter,
    ledBeam,
    moistureHead,
    moistureDeepHead,
    moistureBlade,
    ecBody,
    ecAccent,
    phBody,
    phAccent,
    phGlassBulb,
    impedanceCollar,
    cableJacket,
  ];

  return {
    anodizedFrame,
    enclosureBody,
    enclosureLid,
    rubberGasket,
    stainlessSteel,
    brassHardware,
    copperElectrode,
    goldPin,
    acrylicWindow,
    acrylicSide,
    lidWindow,
    rulerDecal,
    chamberBackplate,
    soilBody,
    rootPrimary,
    rootFine,
    plantLeaf,
    plantStem,
    pcbBoard,
    rfShield,
    darkPolymer,
    cameraBody,
    opticalLens,
    ledHousing,
    ledEmitter,
    ledBeam,
    moistureHead,
    moistureDeepHead,
    moistureBlade,
    ecBody,
    ecAccent,
    phBody,
    phAccent,
    phGlassBulb,
    impedanceCollar,
    cableJacket,
    dispose: () => {
      allMaterials.forEach((m) => m.dispose());
    },
  };
}
