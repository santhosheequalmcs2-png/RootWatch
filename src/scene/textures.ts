import * as THREE from 'three';

function createCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to acquire 2D canvas context for procedural texture.');
  }
  return [canvas, ctx];
}

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface ProceduralTextureSet {
  soilAlbedo: THREE.CanvasTexture;
  soilBump: THREE.CanvasTexture;
  pcbAlbedo: THREE.CanvasTexture;
  pcbRoughness: THREE.CanvasTexture;
  brushedMetalRoughness: THREE.CanvasTexture;
  enclosureGrainBump: THREE.CanvasTexture;
  rulerOverlay: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  ledBeamAlpha: THREE.CanvasTexture;
  floorGrid: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const anisotropy = Math.max(1, Math.min(maxAnisotropy, 16));

  // 1. Soil strata albedo & bump (dark organic agricultural loam with subtle horizons + perlite flecks)
  const [soilCanvas, sCtx] = createCanvas(512, 512);
  const [soilBumpCanvas, sbCtx] = createCanvas(512, 512);
  const randSoil = seededRandom(48271);

  const grad = sCtx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#3e2d20');
  grad.addColorStop(0.22, '#342419');
  grad.addColorStop(0.55, '#2b1e15');
  grad.addColorStop(0.85, '#241811');
  grad.addColorStop(1, '#1f150f');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 512, 512);

  sbCtx.fillStyle = '#808080';
  sbCtx.fillRect(0, 0, 512, 512);

  // Subtle horizontal strata bands
  for (let y = 0; y < 512; y += 6) {
    const shade = Math.floor(20 + randSoil() * 24);
    sCtx.fillStyle = `rgba(${shade + 18}, ${shade + 8}, ${shade}, 0.18)`;
    sCtx.fillRect(0, y, 512, 4 + randSoil() * 6);
  }

  // Organic loam granules and perlite particles
  for (let i = 0; i < 6500; i++) {
    const x = randSoil() * 512;
    const y = randSoil() * 512;
    const r = 0.7 + randSoil() * 2.8;
    const roll = randSoil();
    if (roll > 0.965) {
      // Tiny perlite / mineral fleck
      sCtx.fillStyle = `rgba(196, 186, 168, ${0.28 + randSoil() * 0.25})`;
      sbCtx.fillStyle = `rgba(225, 225, 225, 0.7)`;
    } else if (roll > 0.55) {
      // Dark moist humus clump
      sCtx.fillStyle = `rgba(24, 15, 10, ${0.35 + randSoil() * 0.35})`;
      sbCtx.fillStyle = `rgba(45, 45, 45, 0.55)`;
    } else {
      // Warm clay/loam crumb
      sCtx.fillStyle = `rgba(82, 58, 39, ${0.24 + randSoil() * 0.32})`;
      sbCtx.fillStyle = `rgba(168, 168, 168, 0.5)`;
    }
    sCtx.beginPath();
    sCtx.arc(x, y, r, 0, Math.PI * 2);
    sCtx.fill();

    sbCtx.beginPath();
    sbCtx.arc(x, y, r, 0, Math.PI * 2);
    sbCtx.fill();
  }

  const soilAlbedo = new THREE.CanvasTexture(soilCanvas);
  soilAlbedo.colorSpace = THREE.SRGBColorSpace;
  soilAlbedo.wrapS = THREE.RepeatWrapping;
  soilAlbedo.wrapT = THREE.ClampToEdgeWrapping;
  soilAlbedo.anisotropy = anisotropy;

  const soilBump = new THREE.CanvasTexture(soilBumpCanvas);
  soilBump.wrapS = THREE.RepeatWrapping;
  soilBump.wrapT = THREE.ClampToEdgeWrapping;
  soilBump.anisotropy = anisotropy;

  // 2. ESP32 PCB silkscreen & copper trace albedo + roughness
  const [pcbCanvas, pCtx] = createCanvas(512, 1024);
  const [pcbRoughCanvas, prCtx] = createCanvas(512, 1024);

  // Matte deep forest-charcoal solder mask
  pCtx.fillStyle = '#10241b';
  pCtx.fillRect(0, 0, 512, 1024);
  prCtx.fillStyle = '#a8a8a8';
  prCtx.fillRect(0, 0, 512, 1024);

  // Subtle copper traces beneath solder mask
  pCtx.strokeStyle = '#1b3e2e';
  pCtx.lineWidth = 4;
  prCtx.strokeStyle = '#686868';
  prCtx.lineWidth = 4;
  for (let i = 0; i < 15; i++) {
    const py = 210 + i * 48;
    // Left traces
    pCtx.beginPath();
    pCtx.moveTo(46, py);
    pCtx.lineTo(118, py);
    pCtx.lineTo(155, py - 18);
    pCtx.lineTo(220, py - 18);
    pCtx.stroke();
    prCtx.beginPath();
    prCtx.moveTo(46, py);
    prCtx.lineTo(118, py);
    prCtx.lineTo(155, py - 18);
    prCtx.lineTo(220, py - 18);
    prCtx.stroke();

    // Right traces
    pCtx.beginPath();
    pCtx.moveTo(466, py);
    pCtx.lineTo(392, py);
    pCtx.lineTo(356, py + 12);
    pCtx.lineTo(290, py + 12);
    pCtx.stroke();
  }

  // Gold PCB meander Wi-Fi antenna at top
  pCtx.strokeStyle = '#d4a64a';
  pCtx.lineWidth = 10;
  pCtx.lineCap = 'square';
  pCtx.beginPath();
  pCtx.moveTo(95, 130);
  pCtx.lineTo(95, 48);
  pCtx.lineTo(155, 48);
  pCtx.lineTo(155, 118);
  pCtx.lineTo(215, 118);
  pCtx.lineTo(215, 48);
  pCtx.lineTo(275, 48);
  pCtx.lineTo(275, 118);
  pCtx.lineTo(335, 118);
  pCtx.lineTo(335, 48);
  pCtx.lineTo(415, 48);
  pCtx.lineTo(415, 128);
  pCtx.stroke();

  // Gold plated header pads on left & right rails
  for (let i = 0; i < 15; i++) {
    const py = 210 + i * 48;
    for (const px of [44, 468]) {
      pCtx.fillStyle = '#d9b35a';
      pCtx.beginPath();
      pCtx.arc(px, py, 13, 0, Math.PI * 2);
      pCtx.fill();
      pCtx.fillStyle = '#09120e';
      pCtx.beginPath();
      pCtx.arc(px, py, 5.5, 0, Math.PI * 2);
      pCtx.fill();

      prCtx.fillStyle = '#383838';
      prCtx.beginPath();
      prCtx.arc(px, py, 13, 0, Math.PI * 2);
      prCtx.fill();
    }
  }

  // Crisp silkscreen markings
  pCtx.strokeStyle = 'rgba(235, 240, 232, 0.72)';
  pCtx.lineWidth = 3;
  pCtx.strokeRect(18, 18, 476, 988);
  pCtx.fillStyle = 'rgba(235, 240, 232, 0.88)';
  pCtx.font = 'bold 26px monospace';
  pCtx.textAlign = 'center';
  pCtx.fillText('ROOTWATCH MCU', 256, 610);
  pCtx.font = '18px monospace';
  pCtx.fillStyle = 'rgba(182, 214, 192, 0.82)';
  pCtx.fillText('ESP32-WROOM-32', 256, 646);
  pCtx.fillText('ADC · I2C · WIFI · BLE', 256, 678);

  const leftPins = ['3V3', 'EN', 'VP', 'VN', 'D34', 'D35', 'D32', 'D33', 'D25', 'D26', 'D27', 'D14', 'D12', 'D13', 'GND'];
  const rightPins = ['GND', 'D23', 'D22', 'TX0', 'RX0', 'D21', 'D19', 'D18', 'D5', 'TX2', 'RX2', 'D4', 'D2', 'D15', '5V'];
  pCtx.font = 'bold 14px monospace';
  pCtx.fillStyle = 'rgba(225, 235, 228, 0.82)';
  for (let i = 0; i < 15; i++) {
    const py = 215 + i * 48;
    pCtx.textAlign = 'left';
    pCtx.fillText(leftPins[i], 66, py);
    pCtx.textAlign = 'right';
    pCtx.fillText(rightPins[i], 446, py);
  }

  const pcbAlbedo = new THREE.CanvasTexture(pcbCanvas);
  pcbAlbedo.colorSpace = THREE.SRGBColorSpace;
  pcbAlbedo.anisotropy = anisotropy;

  const pcbRoughness = new THREE.CanvasTexture(pcbRoughCanvas);
  pcbRoughness.anisotropy = anisotropy;

  // 3. Brushed anodized metal micro-grain roughness map
  const [metalCanvas, mCtx] = createCanvas(256, 256);
  const randMetal = seededRandom(91337);
  mCtx.fillStyle = '#909090';
  mCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y++) {
    const val = Math.floor(110 + randMetal() * 55);
    mCtx.fillStyle = `rgb(${val},${val},${val})`;
    mCtx.fillRect(0, y, 256, 1);
  }
  const brushedMetalRoughness = new THREE.CanvasTexture(metalCanvas);
  brushedMetalRoughness.wrapS = THREE.RepeatWrapping;
  brushedMetalRoughness.wrapT = THREE.RepeatWrapping;
  brushedMetalRoughness.anisotropy = anisotropy;

  // 4. Matte powder-coated enclosure fine grain bump map
  const [grainCanvas, gCtx] = createCanvas(256, 256);
  const randGrain = seededRandom(7731);
  const gImg = gCtx.createImageData(256, 256);
  for (let i = 0; i < gImg.data.length; i += 4) {
    const v = Math.floor(115 + randGrain() * 30);
    gImg.data[i] = v;
    gImg.data[i + 1] = v;
    gImg.data[i + 2] = v;
    gImg.data[i + 3] = 255;
  }
  gCtx.putImageData(gImg, 0, 0);
  const enclosureGrainBump = new THREE.CanvasTexture(grainCanvas);
  enclosureGrainBump.wrapS = THREE.RepeatWrapping;
  enclosureGrainBump.wrapT = THREE.RepeatWrapping;
  enclosureGrainBump.repeat.set(3, 3);

  // 5. Acrylic observation window depth-scale etching overlay
  const [rulerCanvas, rCtx] = createCanvas(512, 512);
  rCtx.clearRect(0, 0, 512, 512);
  // Subtle corner frame etch marks
  rCtx.strokeStyle = 'rgba(210, 238, 218, 0.42)';
  rCtx.lineWidth = 2;
  rCtx.strokeRect(10, 10, 492, 492);

  // Right-edge graduated depth ruler (0 to 25 cm)
  rCtx.fillStyle = 'rgba(220, 242, 226, 0.78)';
  rCtx.font = '600 15px monospace';
  rCtx.textAlign = 'right';
  for (let cm = 0; cm <= 25; cm++) {
    const y = 34 + (cm / 25) * 444;
    const isMajor = cm % 5 === 0;
    const tickLen = isMajor ? 22 : 11;
    rCtx.beginPath();
    rCtx.moveTo(498, y);
    rCtx.lineTo(498 - tickLen, y);
    rCtx.strokeStyle = isMajor ? 'rgba(225, 246, 232, 0.72)' : 'rgba(200, 230, 210, 0.4)';
    rCtx.lineWidth = isMajor ? 2 : 1.2;
    rCtx.stroke();

    if (isMajor) {
      rCtx.fillText(`${cm} cm`, 470, y + 5);
    }
  }
  // Subtle top-left etched chamber mark
  rCtx.textAlign = 'left';
  rCtx.font = '600 14px monospace';
  rCtx.fillStyle = 'rgba(205, 236, 214, 0.56)';
  rCtx.fillText('RHIZOBOX WINDOW · DEPTH SCALE', 24, 34);

  const rulerOverlay = new THREE.CanvasTexture(rulerCanvas);
  rulerOverlay.colorSpace = THREE.SRGBColorSpace;
  rulerOverlay.anisotropy = anisotropy;

  // 6. Soft radial contact shadow
  const [shadowCanvas, shCtx] = createCanvas(512, 512);
  const shGrad = shCtx.createRadialGradient(256, 256, 30, 256, 256, 248);
  shGrad.addColorStop(0, 'rgba(0, 0, 0, 0.68)');
  shGrad.addColorStop(0.45, 'rgba(0, 0, 0, 0.36)');
  shGrad.addColorStop(0.75, 'rgba(0, 0, 0, 0.11)');
  shGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  shCtx.fillStyle = shGrad;
  shCtx.fillRect(0, 0, 512, 512);
  const contactShadow = new THREE.CanvasTexture(shadowCanvas);

  // 7. LED beam soft volumetric falloff gradient
  const [beamCanvas, bCtx] = createCanvas(64, 256);
  const bGrad = bCtx.createLinearGradient(0, 0, 0, 256);
  bGrad.addColorStop(0, 'rgba(232, 252, 238, 0.55)');
  bGrad.addColorStop(0.35, 'rgba(218, 248, 228, 0.22)');
  bGrad.addColorStop(1, 'rgba(195, 240, 212, 0.0)');
  bCtx.fillStyle = bGrad;
  bCtx.fillRect(0, 0, 64, 256);
  const ledBeamAlpha = new THREE.CanvasTexture(beamCanvas);

  // 8. Architectural lab floor grid
  const [gridCanvas, grCtx] = createCanvas(512, 512);
  grCtx.fillStyle = '#0c1310';
  grCtx.fillRect(0, 0, 512, 512);
  // Fine subdivisions
  grCtx.strokeStyle = 'rgba(92, 148, 112, 0.08)';
  grCtx.lineWidth = 1;
  for (let i = 0; i <= 512; i += 64) {
    grCtx.beginPath();
    grCtx.moveTo(i, 0);
    grCtx.lineTo(i, 512);
    grCtx.stroke();
    grCtx.beginPath();
    grCtx.moveTo(0, i);
    grCtx.lineTo(512, i);
    grCtx.stroke();
  }
  // Major lines
  grCtx.strokeStyle = 'rgba(116, 178, 138, 0.16)';
  grCtx.lineWidth = 1.5;
  grCtx.strokeRect(0.75, 0.75, 510.5, 510.5);

  const floorGrid = new THREE.CanvasTexture(gridCanvas);
  floorGrid.colorSpace = THREE.SRGBColorSpace;
  floorGrid.wrapS = THREE.RepeatWrapping;
  floorGrid.wrapT = THREE.RepeatWrapping;
  floorGrid.repeat.set(16, 16);
  floorGrid.anisotropy = anisotropy;

  const allTextures = [
    soilAlbedo,
    soilBump,
    pcbAlbedo,
    pcbRoughness,
    brushedMetalRoughness,
    enclosureGrainBump,
    rulerOverlay,
    contactShadow,
    ledBeamAlpha,
    floorGrid,
  ];

  return {
    soilAlbedo,
    soilBump,
    pcbAlbedo,
    pcbRoughness,
    brushedMetalRoughness,
    enclosureGrainBump,
    rulerOverlay,
    contactShadow,
    ledBeamAlpha,
    floorGrid,
    dispose: () => {
      allTextures.forEach((t) => t.dispose());
    },
  };
}
