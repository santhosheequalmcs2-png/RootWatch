import {
  ChevronDown,
  ChevronUp,
  Layers,
  Radio,
  RotateCcw,
  Tag,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DEVICE_PARTS } from '../../data/samples';
import { useApp } from '../../i18n/LanguageContext';
import {
  applyStudioEnvironmentAndLights,
  createAfterDraw,
  createContactShadowTexture,
  createPcbTexture,
  createStudioRenderer,
  detectSoftwareGl,
} from './threeUtils';

interface DeviceExplorerSceneProps {
  selectedPartId: string;
  onSelectPart: (partId: string) => void;
}

interface PartGroupRecord {
  id: string;
  group: THREE.Group;
  assembledPos: THREE.Vector3;
  explodedOffset: THREE.Vector3;
  labelAnchor: THREE.Vector3;
  meshes: THREE.Mesh[];
}

interface ProjectedPin {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}

export function DeviceExplorerScene({
  selectedPartId,
  onSelectPart,
}: DeviceExplorerSceneProps) {
  const { t } = useApp();
  const mountRef = useRef<HTMLDivElement | null>(null);

  const [exploded, setExploded] = useState(false);
  const [scanActive, setScanActive] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [dockOpen, setDockOpen] = useState(true);
  const [pins, setPins] = useState<ProjectedPin[]>([]);
  const [webglError, setWebglError] = useState(false);

  const onSelectPartRef = useRef(onSelectPart);
  useEffect(() => {
    onSelectPartRef.current = onSelectPart;
  }, [onSelectPart]);

  const stateRef = useRef({
    selectedPartId,
    exploded: false,
    scanActive: true,
    showLabels: true,
    resetCameraRequested: false,
  });

  useEffect(() => {
    stateRef.current.selectedPartId = selectedPartId;
  }, [selectedPartId]);

  useEffect(() => {
    stateRef.current.exploded = exploded;
  }, [exploded]);

  useEffect(() => {
    stateRef.current.scanActive = scanActive;
  }, [scanActive]);

  useEffect(() => {
    stateRef.current.showLabels = showLabels;
  }, [showLabels]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let disposed = false;
    let renderer: THREE.WebGLRenderer;
    const isSoftwareGl = detectSoftwareGl();

    try {
      renderer = createStudioRenderer(container, isSoftwareGl);
    } catch {
      setWebglError(true);
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f1c15);
    scene.fog = new THREE.FogExp2(0x0f1c15, 0.032);

    const camera = new THREE.PerspectiveCamera(
      40,
      Math.max(container.clientWidth, 300) / Math.max(container.clientHeight, 320),
      0.1,
      60,
    );
    const defaultCamPos = new THREE.Vector3(5.1, 1.9, 6.6);
    const defaultTarget = new THREE.Vector3(0, 0.05, 0);
    camera.position.copy(defaultCamPos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(defaultTarget);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 2.6;
    controls.maxDistance = 11.5;
    controls.update();

    const { envTex } = applyStudioEnvironmentAndLights(scene, renderer, isSoftwareGl, 6);
    const pcbTex = createPcbTexture(renderer);
    const shadowTex = createContactShadowTexture();

    // Subtle studio pedestal disc & contact shadow
    const contactShadow = new THREE.Mesh(
      new THREE.CircleGeometry(2.9, 44),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.72,
      }),
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = -2.35;
    scene.add(contactShadow);

    const floorRing = new THREE.Mesh(
      new THREE.RingGeometry(2.1, 2.16, 64),
      new THREE.MeshBasicMaterial({
        color: 0x3b6e52,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      }),
    );
    floorRing.rotation.x = -Math.PI / 2;
    floorRing.position.y = -2.33;
    scene.add(floorRing);

    const rootAssembly = new THREE.Group();
    scene.add(rootAssembly);

    // Shared calibrated PBR materials (distinct roughness & metalness across adjacent parts)
    const matEnclosure = new THREE.MeshStandardMaterial({
      color: 0x1e4a34,
      roughness: 0.56,
      metalness: 0.18,
    });
    const matEnclosureTrim = new THREE.MeshStandardMaterial({
      color: 0x10291c,
      roughness: 0.72,
      metalness: 0.12,
    });
    const matStainless = new THREE.MeshStandardMaterial({
      color: 0xcbd5d0,
      roughness: 0.24,
      metalness: 0.88,
    });
    const matDarkMetal = new THREE.MeshStandardMaterial({
      color: 0x26322d,
      roughness: 0.36,
      metalness: 0.78,
    });
    const matCopper = new THREE.MeshStandardMaterial({
      color: 0xc98a4b,
      roughness: 0.32,
      metalness: 0.85,
    });
    const matAcrylic = new THREE.MeshPhysicalMaterial({
      color: 0xdff6ea,
      roughness: 0.1,
      metalness: 0.04,
      transparent: true,
      opacity: isSoftwareGl ? 0.34 : 0.28,
      clearcoat: 1.0,
      depthWrite: false,
    });
    const matPcb = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: pcbTex,
      roughness: 0.48,
      metalness: 0.25,
    });
    const matLedEmit = new THREE.MeshStandardMaterial({
      color: 0xf4fff8,
      emissive: 0x9ef5be,
      emissiveIntensity: 1.2,
      roughness: 0.2,
    });
    const matCable = new THREE.MeshStandardMaterial({
      color: 0x1b211e,
      roughness: 0.78,
      metalness: 0.08,
    });
    const matRootCream = new THREE.MeshStandardMaterial({
      color: 0xeadec2,
      roughness: 0.68,
      metalness: 0.02,
    });
    const matGlassBulb = new THREE.MeshPhysicalMaterial({
      color: 0x7dd3fc,
      roughness: 0.12,
      metalness: 0.05,
      transparent: true,
      opacity: 0.65,
    });

    const partRecords: PartGroupRecord[] = [];
    const clickableMeshes: THREE.Mesh[] = [];

    function registerPart(
      id: string,
      assembledPos: THREE.Vector3,
      explodedOffset: THREE.Vector3,
      labelAnchor: THREE.Vector3,
      builder: (g: THREE.Group) => void,
    ) {
      const group = new THREE.Group();
      group.position.copy(assembledPos);
      builder(group);

      const meshes: THREE.Mesh[] = [];
      group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          // Clone material per component so highlight tint does not bleed across unrelated parts
          if (!Array.isArray(m.material)) {
            m.material = m.material.clone();
          }
          m.userData.partId = id;
          m.castShadow = !isSoftwareGl;
          m.receiveShadow = !isSoftwareGl;
          meshes.push(m);
          clickableMeshes.push(m);
        }
      });

      rootAssembly.add(group);
      partRecords.push({ id, group, assembledPos, explodedOffset, labelAnchor, meshes });
      return group;
    }

    // 1. Main Electronics Enclosure (beveled top housing + lid seam + OLED faceplate + status bezel)
    registerPart(
      'enclosure',
      new THREE.Vector3(0, 1.38, 0),
      new THREE.Vector3(0, 0.65, -0.2),
      new THREE.Vector3(0, 0.45, 0.42),
      (g) => {
        const shape = new THREE.Shape();
        const w = 0.82;
        const h = 0.56;
        const r = 0.08;
        shape.moveTo(-w + r, -h);
        shape.lineTo(w - r, -h);
        shape.quadraticCurveTo(w, -h, w, -h + r);
        shape.lineTo(w, h - r);
        shape.quadraticCurveTo(w, h, w - r, h);
        shape.lineTo(-w + r, h);
        shape.quadraticCurveTo(-w, h, -w, h - r);
        shape.lineTo(-w, -h + r);
        shape.quadraticCurveTo(-w, -h, -w + r, -h);

        const bodyGeo = new THREE.ExtrudeGeometry(shape, {
          depth: 0.62,
          bevelEnabled: true,
          bevelThickness: 0.05,
          bevelSize: 0.05,
          bevelSegments: 3,
        });
        bodyGeo.center();
        const body = new THREE.Mesh(bodyGeo, matEnclosure);
        g.add(body);

        // Front gasket & face bezel
        const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.9, 0.06), matEnclosureTrim);
        bezel.position.set(0, 0, 0.34);
        g.add(bezel);

        // Mini OLED status display window
        const oled = new THREE.Mesh(
          new THREE.BoxGeometry(0.62, 0.32, 0.02),
          new THREE.MeshStandardMaterial({
            color: 0x0b1711,
            emissive: 0x1b5e3b,
            emissiveIntensity: 0.55,
            roughness: 0.2,
          }),
        );
        oled.position.set(-0.24, 0.14, 0.37);
        g.add(oled);

        // Top LoRa / Wi-Fi waterproof antenna stub
        const antBase = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.1, 14), matDarkMetal);
        antBase.position.set(0.54, 0.65, -0.06);
        g.add(antBase);
        const antMast = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.042, 0.56, 12), matEnclosureTrim);
        antMast.position.set(0.54, 0.96, -0.06);
        g.add(antMast);
      },
    );

    // 2. ESP32 Electronics Board (inside enclosure bay, glides cleanly forward when exploded)
    registerPart(
      'esp32',
      new THREE.Vector3(0, 1.38, 0.04),
      new THREE.Vector3(0, 0.68, 1.05),
      new THREE.Vector3(0.45, 0.35, 0.15),
      (g) => {
        const pcb = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.72, 0.05), matPcb);
        g.add(pcb);

        // Metallic ESP32-S3 RF Shield module
        const rfShield = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.08), matStainless);
        rfShield.position.set(-0.26, 0.06, 0.06);
        g.add(rfShield);

        // Green screw terminal block along bottom edge
        const terminals = new THREE.Mesh(
          new THREE.BoxGeometry(0.86, 0.13, 0.11),
          new THREE.MeshStandardMaterial({ color: 0x267346, roughness: 0.5 }),
        );
        terminals.position.set(0.04, -0.25, 0.06);
        g.add(terminals);

        // USB-C port
        const usb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.08), matStainless);
        usb.position.set(0.44, 0.18, 0.06);
        g.add(usb);
      },
    );

    // 3. Transparent Root Observation Chamber (clear acrylic viewing box + stainless corner frame)
    registerPart(
      'chamber',
      new THREE.Vector3(0, -0.45, 0.25),
      new THREE.Vector3(0, -0.25, 0.95),
      new THREE.Vector3(0.65, 0.65, 0.35),
      (g) => {
        const glassBox = new THREE.Mesh(new THREE.BoxGeometry(1.32, 1.62, 0.56), matAcrylic);
        glassBox.renderOrder = 6;
        g.add(glassBox);

        // Top & bottom anodized collar rails
        const topRail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.64), matEnclosureTrim);
        topRail.position.y = 0.82;
        g.add(topRail);

        const bottomRail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.64), matEnclosureTrim);
        bottomRail.position.y = -0.82;
        g.add(bottomRail);

        // Four vertical stainless steel corner rods
        const corners = [
          [-0.65, -0.27],
          [0.65, -0.27],
          [-0.65, 0.27],
          [0.65, 0.27],
        ];
        corners.forEach(([cx, cz]) => {
          const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.66, 10), matStainless);
          rod.position.set(cx, 0, cz);
          g.add(rod);
        });
      },
    );

    // 4. Root System Inside Chamber (multi-branch procedural roots visible through transparent glass)
    registerPart(
      'roots',
      new THREE.Vector3(0, -0.45, 0.22),
      new THREE.Vector3(0, -0.25, 1.85),
      new THREE.Vector3(-0.35, -0.1, 0.25),
      (g) => {
        // Dark soil backing slab inside chamber
        const soilBacking = new THREE.Mesh(
          new THREE.BoxGeometry(1.18, 1.46, 0.28),
          new THREE.MeshStandardMaterial({ color: 0x3a2619, roughness: 0.95 }),
        );
        soilBacking.position.z = -0.08;
        g.add(soilBacking);

        const rootPaths: THREE.Vector3[][] = [
          [
            new THREE.Vector3(0, 0.68, 0.14),
            new THREE.Vector3(0.04, 0.18, 0.18),
            new THREE.Vector3(-0.03, -0.32, 0.16),
            new THREE.Vector3(0.02, -0.68, 0.14),
          ],
          [
            new THREE.Vector3(0.02, 0.42, 0.16),
            new THREE.Vector3(0.28, 0.14, 0.19),
            new THREE.Vector3(0.46, -0.28, 0.17),
          ],
          [
            new THREE.Vector3(-0.01, 0.34, 0.16),
            new THREE.Vector3(-0.26, 0.02, 0.19),
            new THREE.Vector3(-0.48, -0.36, 0.16),
          ],
          [
            new THREE.Vector3(0.02, -0.02, 0.17),
            new THREE.Vector3(0.24, -0.28, 0.19),
            new THREE.Vector3(0.38, -0.62, 0.15),
          ],
          [
            new THREE.Vector3(-0.02, -0.1, 0.17),
            new THREE.Vector3(-0.22, -0.4, 0.18),
            new THREE.Vector3(-0.35, -0.66, 0.15),
          ],
        ];
        rootPaths.forEach((pts, idx) => {
          const curve = new THREE.CatmullRomCurve3(pts);
          const tube = new THREE.Mesh(
            new THREE.TubeGeometry(curve, 18, idx === 0 ? 0.034 : 0.019, 8, false),
            matRootCream,
          );
          g.add(tube);
        });
      },
    );

    // 5. Camera Module (facing the transparent observation chamber window)
    registerPart(
      'camera',
      new THREE.Vector3(0, -0.35, -0.34),
      new THREE.Vector3(0, -0.15, -1.25),
      new THREE.Vector3(-0.28, 0.22, -0.15),
      (g) => {
        const board = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.08), matDarkMetal);
        g.add(board);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.22, 20), matEnclosureTrim);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = 0.12;
        g.add(barrel);
        const lens = new THREE.Mesh(
          new THREE.CylinderGeometry(0.09, 0.09, 0.04, 20),
          new THREE.MeshPhysicalMaterial({
            color: 0x226688,
            roughness: 0.08,
            metalness: 0.2,
            clearcoat: 1.0,
          }),
        );
        lens.rotation.x = Math.PI / 2;
        lens.position.z = 0.22;
        g.add(lens);
      },
    );

    // 6. LED Lighting Ring (surrounding the camera optical barrel)
    let ledRingMesh: THREE.Mesh | null = null;
    registerPart(
      'leds',
      new THREE.Vector3(0, -0.35, -0.14),
      new THREE.Vector3(0, -0.15, -0.58),
      new THREE.Vector3(0.32, 0.28, 0),
      (g) => {
        const ringHousing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.038, 12, 32), matDarkMetal);
        g.add(ringHousing);
        ledRingMesh = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.022, 10, 32), matLedEmit);
        ledRingMesh.position.z = 0.025;
        g.add(ledRingMesh);
      },
    );

    // 7. Soil Moisture Probes (Dual-depth capacitive twin prongs at 10cm & 25cm)
    registerPart(
      'moisture_probes',
      new THREE.Vector3(-1.02, -0.65, 0.12),
      new THREE.Vector3(-1.2, -0.25, 0.25),
      new THREE.Vector3(-0.18, 0.52, 0),
      (g) => {
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.14), matDarkMetal);
        head.position.y = 0.45;
        g.add(head);
        // Short 10cm tine
        const tine10 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 0.025), matCopper);
        tine10.position.set(-0.06, -0.05, 0);
        g.add(tine10);
        // Deep 25cm tine
        const tine25 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.48, 0.025), matCopper);
        tine25.position.set(0.06, -0.36, 0);
        g.add(tine25);
      },
    );

    // 8. Temperature Sensor (Waterproof stainless DS18B20 probe)
    registerPart(
      'temp_sensor',
      new THREE.Vector3(-1.38, -0.82, -0.22),
      new THREE.Vector3(-1.55, -0.45, -0.35),
      new THREE.Vector3(-0.1, 0.45, 0),
      (g) => {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.22, 14), matCable);
        cap.position.y = 0.36;
        g.add(cap);
        const steelProbe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.92, 16), matStainless);
        steelProbe.position.y = -0.18;
        g.add(steelProbe);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 12), matStainless);
        tip.position.y = -0.64;
        g.add(tip);
      },
    );

    // 9. EC Sensor (Graphite/titanium conductivity dual-ring probe)
    registerPart(
      'ec_sensor',
      new THREE.Vector3(1.04, -0.72, 0.18),
      new THREE.Vector3(1.22, -0.28, 0.3),
      new THREE.Vector3(0.18, 0.48, 0),
      (g) => {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.92, 16), matDarkMetal);
        g.add(body);
        const ring1 = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.14, 16), matStainless);
        ring1.position.y = -0.22;
        g.add(ring1);
        const ring2 = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.14, 16), matStainless);
        ring2.position.y = -0.46;
        g.add(ring2);
      },
    );

    // 10. pH Sensor (Perforated guard + cyan glass bulb tip)
    registerPart(
      'ph_sensor',
      new THREE.Vector3(1.38, -0.82, -0.18),
      new THREE.Vector3(1.58, -0.42, -0.28),
      new THREE.Vector3(0.15, 0.42, 0),
      (g) => {
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.065, 0.96, 16), matEnclosure);
        g.add(shaft);
        const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.072, 0.24, 14, 1, true), matDarkMetal);
        guard.position.y = -0.56;
        g.add(guard);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), matGlassBulb);
        bulb.position.y = -0.62;
        g.add(bulb);
      },
    );

    // 11. Impedance Electrodes (Experimental twin stainless pin array)
    registerPart(
      'impedance',
      new THREE.Vector3(0.0, -1.58, 0.25),
      new THREE.Vector3(0.0, -0.85, 0.45),
      new THREE.Vector3(0.32, -0.15, 0.15),
      (g) => {
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.16), matDarkMetal);
        g.add(bridge);
        const pinL = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.014, 0.68, 12), matCopper);
        pinL.position.set(-0.18, -0.38, 0);
        g.add(pinL);
        const pinR = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.014, 0.68, 12), matCopper);
        pinR.position.set(0.18, -0.38, 0);
        g.add(pinR);
      },
    );

    // 12. Waterproof Cable Connections (curved conduits from enclosure glands to probes)
    registerPart(
      'cables',
      new THREE.Vector3(0, 0.45, -0.15),
      new THREE.Vector3(0, 0.45, -0.95),
      new THREE.Vector3(-0.68, 0.2, -0.15),
      (g) => {
        const leftCable = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.42, 0.38, 0.1),
          new THREE.Vector3(-0.82, 0.12, 0.08),
          new THREE.Vector3(-1.02, -0.56, 0.22),
        ]);
        const rightCable = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.42, 0.38, 0.1),
          new THREE.Vector3(0.84, 0.1, 0.1),
          new THREE.Vector3(1.04, -0.62, 0.26),
        ]);
        const rearCable = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0.38, -0.08),
          new THREE.Vector3(0, -0.08, -0.26),
          new THREE.Vector3(0, -0.68, -0.2),
        ]);
        [leftCable, rightCable, rearCable].forEach((c) => {
          g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 16, 0.032, 8, false), matCable));
        });
      },
    );

    // 13. Mounting Structure (304 stainless field stake + cross collar bracket)
    registerPart(
      'mounting',
      new THREE.Vector3(0, -0.2, -0.62),
      new THREE.Vector3(0, -0.2, -1.9),
      new THREE.Vector3(0.22, 0.8, -0.1),
      (g) => {
        const mainPole = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 4.15, 16), matStainless);
        mainPole.position.y = -0.05;
        g.add(mainPole);

        const groundSpike = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.32, 16), matStainless);
        groundSpike.rotation.x = Math.PI;
        groundSpike.position.y = -2.24;
        g.add(groundSpike);

        const upperCollar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.56), matDarkMetal);
        upperCollar.position.set(0, 1.48, 0.26);
        g.add(upperCollar);

        const lowerBracket = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.34), matDarkMetal);
        lowerBracket.position.set(0, -0.22, 0.16);
        g.add(lowerBracket);
      },
    );

    // Live Monitoring Scan Plane sweeping gently inside the observation chamber
    const scanPlaneMat = new THREE.MeshBasicMaterial({
      color: 0x5eeea0,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const scanPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 0.045), scanPlaneMat);
    scanPlane.position.set(0, -0.45, 0.55);
    scanPlane.renderOrder = 8;
    rootAssembly.add(scanPlane);

    // Probe signal pulse ring beneath soil probes
    const pulseRingMat = new THREE.MeshBasicMaterial({
      color: 0x62e39a,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.38, 36), pulseRingMat);
    pulseRing.rotation.x = -Math.PI / 2;
    pulseRing.position.set(0, -1.72, 0.15);
    rootAssembly.add(pulseRing);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting for component click selection
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return; // Ignore orbit drags
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, false);
      if (hits.length > 0) {
        const partId = hits[0].object.userData.partId as string | undefined;
        if (partId) {
          onSelectPartRef.current(partId);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const onControlsStart = () => {
      stateRef.current.resetCameraRequested = false;
    };
    controls.addEventListener('start', onControlsStart);

    const onContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const handleResize = () => {
      if (!container || disposed) return;
      const w = Math.max(container.clientWidth, 300);
      const h = Math.max(container.clientHeight, 320);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Scratch vectors outside render loop (zero GC)
    const _targetPos = new THREE.Vector3();
    const _worldAnchor = new THREE.Vector3();
    const _camGoal = new THREE.Vector3();
    const _ctrlGoal = new THREE.Vector3();
    const _highlightColor = new THREE.Color(0x2fa866);
    const _zeroColor = new THREE.Color(0x000000);

    const afterDraw = createAfterDraw(renderer);
    let rafId = 0;
    let lastTime = performance.now();
    let lastPinUpdate = 0;
    let explodeFactor = 0;

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const s = stateRef.current;

      // Smooth exponential damping for exploded assembly separation
      const targetExplode = s.exploded ? 1 : 0;
      explodeFactor = THREE.MathUtils.damp(explodeFactor, targetExplode, 6.5, dt);

      for (const rec of partRecords) {
        _targetPos.copy(rec.assembledPos).addScaledVector(rec.explodedOffset, explodeFactor);
        rec.group.position.copy(_targetPos);

        const isSelected = rec.id === s.selectedPartId;
        for (const m of rec.meshes) {
          const mat = m.material as THREE.MeshStandardMaterial;
          if (mat && mat.emissive && rec.id !== 'leds') {
            mat.emissive.copy(isSelected ? _highlightColor : _zeroColor);
            mat.emissiveIntensity = isSelected ? 0.55 : 0;
          }
        }
      }

      // Live monitoring scan animation
      scanPlane.visible = s.scanActive && explodeFactor < 0.45;
      pulseRing.visible = s.scanActive;
      if (s.scanActive) {
        const wave = Math.sin(now * 0.0022);
        scanPlane.position.y = -0.45 + wave * 0.68;
        const pulsePhase = (now * 0.00085) % 1;
        pulseRing.scale.setScalar(0.8 + pulsePhase * 2.8);
        pulseRingMat.opacity = (1 - pulsePhase) * 0.45;
        if (ledRingMesh) {
          const ledMat = ledRingMesh.material as THREE.MeshStandardMaterial;
          ledMat.emissiveIntensity = 0.9 + Math.abs(wave) * 0.9;
        }
      }

      // Smooth camera reset
      if (s.resetCameraRequested) {
        _camGoal.copy(defaultCamPos);
        _ctrlGoal.copy(defaultTarget);
        camera.position.lerp(_camGoal, 1 - Math.exp(-6 * dt));
        controls.target.lerp(_ctrlGoal, 1 - Math.exp(-6 * dt));
        if (camera.position.distanceTo(_camGoal) < 0.03) {
          camera.position.copy(_camGoal);
          controls.target.copy(_ctrlGoal);
          s.resetCameraRequested = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      // Update projected 2D component pins at <= 8Hz when labels are enabled
      if (s.showLabels && now - lastPinUpdate > 140) {
        lastPinUpdate = now;
        const w = container.clientWidth;
        const h = container.clientHeight;
        const nextPins: ProjectedPin[] = [];
        // Keep labels uncluttered: project key representative parts + active selected part
        const pinIds = new Set([
          'enclosure',
          'chamber',
          'camera',
          'moisture_probes',
          'ec_sensor',
          'impedance',
          s.selectedPartId,
        ]);
        for (const rec of partRecords) {
          if (!pinIds.has(rec.id)) continue;
          _worldAnchor.copy(rec.labelAnchor).applyMatrix4(rec.group.matrixWorld);
          _worldAnchor.project(camera);
          const visible = _worldAnchor.z > -1 && _worldAnchor.z < 1;
          const rawX = ((_worldAnchor.x + 1) / 2) * w;
          const rawY = ((-_worldAnchor.y + 1) / 2) * h;
          nextPins.push({
            id: rec.id,
            x: THREE.MathUtils.clamp(rawX, 95, Math.max(96, w - 95)),
            y: THREE.MathUtils.clamp(rawY, 26, Math.max(28, h - 108)),
            visible,
          });
        }
        setPins(nextPins);
      }

      if (isSoftwareGl) {
        afterDraw.schedule(tick);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      afterDraw.cancel();
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlsStart);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      envTex.dispose();
      pcbTex.dispose();
      shadowTex.dispose();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material.dispose();
          }
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (webglError) {
    return (
      <div className="flex h-[540px] items-center justify-center rounded-xl border border-[#234232] bg-[#0F1C15] p-6 text-center text-sm text-[#CBE3D5]">
        WebGL 3D Device Explorer is unavailable in this browser environment.
      </div>
    );
  }

  return (
    <div
      data-testid="device-explorer-3d"
      data-exploded={exploded ? 'true' : 'false'}
      data-selected-part={selectedPartId}
      className="relative h-[540px] w-full overflow-hidden rounded-xl border border-[#234232] bg-[#0F1C15] lg:h-[620px]"
    >
      {/* Isolated WebGL canvas mount */}
      <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

      {/* Projected 3D Component Labels (selectable buttons, solid dark fill without backdrop-blur) */}
      {showLabels && (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
          {pins.map((pin) => {
            if (!pin.visible) return null;
            const spec = DEVICE_PARTS.find((p) => p.id === pin.id);
            if (!spec) return null;
            const isActive = pin.id === selectedPartId;
            return (
              <button
                key={pin.id}
                type="button"
                onClick={() => onSelectPart(pin.id)}
                style={{
                  transform: `translate3d(${Math.round(pin.x)}px, ${Math.round(pin.y)}px, 0) translate(-50%, -50%)`,
                }}
                className={`pointer-events-auto absolute top-0 left-0 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-[#66D993] bg-[#1F5A39] text-white shadow-md'
                    : 'border-white/20 bg-[#0D1A13]/90 text-[#CBE3D5] hover:border-[#66D993] hover:text-white'
                }`}
              >
                {t(spec.nameKey)}
              </button>
            );
          })}
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock (no side panels occluding 3D center) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3.5 z-20 flex flex-col items-center px-3">
        <button
          type="button"
          onClick={() => setDockOpen((v) => !v)}
          aria-expanded={dockOpen}
          className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-[#0D1A13]/95 px-2.5 py-1 text-xs font-medium text-[#D5E9DE] transition-colors hover:bg-[#173023] whitespace-nowrap shrink-0"
        >
          {dockOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          <span>{dockOpen ? t('three_hide_controls') : t('three_show_controls')}</span>
        </button>

        {dockOpen && (
          <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#0D1A13]/95 px-3 py-2 text-xs text-white shadow-lg">
            <button
              type="button"
              onClick={() => setExploded((v) => !v)}
              aria-pressed={exploded}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors whitespace-nowrap shrink-0 ${
                exploded
                  ? 'bg-[#2E7D4F] text-white hover:bg-[#256640]'
                  : 'border border-white/20 bg-[#15291E] text-[#DCEFE4] hover:bg-[#1D3B2B]'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>{exploded ? t('three_assembled_view') : t('three_exploded_view')}</span>
            </button>

            <button
              type="button"
              onClick={() => setScanActive((v) => !v)}
              aria-pressed={scanActive}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-medium transition-colors whitespace-nowrap shrink-0 ${
                scanActive
                  ? 'border-[#4D9E6C] bg-[#1B3A2A] text-[#DCF5E5]'
                  : 'border-white/15 bg-transparent text-[#9FB8AA] hover:text-white'
              }`}
            >
              <Radio className="h-3.5 w-3.5" />
              <span>{t('three_scan_anim')}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLabels((v) => !v)}
              aria-pressed={showLabels}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-medium transition-colors whitespace-nowrap shrink-0 ${
                showLabels
                  ? 'border-[#4D9E6C] bg-[#1B3A2A] text-[#DCF5E5]'
                  : 'border-white/15 bg-transparent text-[#9FB8AA] hover:text-white'
              }`}
            >
              <Tag className="h-3.5 w-3.5" />
              <span>{t('three_show_labels')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stateRef.current.resetCameraRequested = true;
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 font-medium text-[#D5E9DE] transition-colors hover:bg-white/10 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{t('three_reset_camera')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
