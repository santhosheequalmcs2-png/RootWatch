import * as THREE from 'three';
import type { ComponentId } from '../data/componentsData';
import type { DeviceMaterialLibrary } from './materials';
import { buildCropSeedling, buildProceduralRootSystem } from './rootSystemBuilder';

export interface AnimatedPartHandle {
  object: THREE.Object3D;
  assembledPosition: THREE.Vector3;
  explodedOffset: THREE.Vector3;
  assembledRotation?: THREE.Euler;
  explodedRotationOffset?: THREE.Euler;
}

export interface RootWatchDeviceRig {
  root: THREE.Group;
  componentGroups: Record<ComponentId, THREE.Group>;
  anchors: Record<ComponentId, THREE.Object3D>;
  animatedParts: AnimatedPartHandle[];
  lidPart: AnimatedPartHandle;
  esp32Part: AnimatedPartHandle;
  clickableMeshes: THREE.Object3D[];
  ledBeamMaterials: THREE.MeshBasicMaterial[];
  ledEmitterMaterials: THREE.MeshStandardMaterial[];
  setHighlightState: (
    selectedId: ComponentId | null,
    highlightedIds: ComponentId[],
    hoveredId: ComponentId | null,
  ) => void;
  setLedBoost: (boost: number) => void;
  dispose: () => void;
}

interface HighlightMaterialEntry {
  material: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
  baseEmissive: THREE.Color;
  baseEmissiveIntensity: number;
  baseOpacity: number;
}

function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  s.moveTo(x + radius, y);
  s.lineTo(x + width - radius, y);
  s.quadraticCurveTo(x + width, y, x + width, y + radius);
  s.lineTo(x + width, y + height - radius);
  s.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  s.lineTo(x + radius, y + height);
  s.quadraticCurveTo(x, y + height, x, y + height - radius);
  s.lineTo(x, y + radius);
  s.quadraticCurveTo(x, y, x + radius, y);
  return s;
}

function createExtrudedRoundedBox(
  width: number,
  height: number,
  depth: number,
  radius: number,
  bevelSize = 0.03,
): THREE.ExtrudeGeometry {
  const shape = createRoundedRectShape(width, height, radius);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, depth - bevelSize * 2),
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize,
    bevelThickness: bevelSize,
  });
  geo.center();
  return geo;
}

function createRoundedFrameShape(
  outerW: number,
  outerH: number,
  innerW: number,
  innerH: number,
  outerR: number,
  innerR: number,
): THREE.Shape {
  const shape = createRoundedRectShape(outerW, outerH, outerR);
  const hole = new THREE.Path();
  const x = -innerW / 2;
  const y = -innerH / 2;
  hole.moveTo(x + innerR, y);
  hole.lineTo(x + innerW - innerR, y);
  hole.quadraticCurveTo(x + innerW, y, x + innerW, y + innerR);
  hole.lineTo(x + innerW, y + innerH - innerR);
  hole.quadraticCurveTo(x + innerW, y + innerH, x + innerW - innerR, y + innerH);
  hole.lineTo(x + innerR, y + innerH);
  hole.quadraticCurveTo(x, y + innerH, x, y + innerH - innerR);
  hole.lineTo(x, y + innerR);
  hole.quadraticCurveTo(x, y, x + innerR, y);
  shape.holes.push(hole);
  return shape;
}

function createCurvedCable(
  points: THREE.Vector3[],
  radius: number,
  material: THREE.Material,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 24, radius, 8, false);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

export function buildRootWatchDevice(materials: DeviceMaterialLibrary): RootWatchDeviceRig {
  const root = new THREE.Group();
  root.name = 'RootWatchDeviceRoot';

  const componentGroups = {} as Record<ComponentId, THREE.Group>;
  const anchors = {} as Record<ComponentId, THREE.Object3D>;
  const animatedParts: AnimatedPartHandle[] = [];
  const clickableMeshes: THREE.Object3D[] = [];
  const highlightMap: Record<ComponentId, HighlightMaterialEntry[]> = {
    enclosure: [],
    esp32: [],
    'root-chamber': [],
    'root-system': [],
    camera: [],
    leds: [],
    'moisture-1': [],
    'moisture-2': [],
    'temp-sensor': [],
    'ec-sensor': [],
    'ph-sensor': [],
    impedance: [],
  };
  const clonedMaterialsToDispose: THREE.Material[] = [];
  const geometriesToDispose: THREE.BufferGeometry[] = [];
  const ledBeamMaterials: THREE.MeshBasicMaterial[] = [];
  const ledEmitterMaterials: THREE.MeshStandardMaterial[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometriesToDispose.push(g);
    return g;
  };

  // Helper to isolate materials per component so highlight emissive never bleeds across components
  const registerComponent = (
    id: ComponentId,
    group: THREE.Group,
    anchorPos: [number, number, number],
    explodedOffset: [number, number, number],
    explodedRotationOffset?: [number, number, number],
  ): AnimatedPartHandle => {
    group.name = `Component_${id}`;
    componentGroups[id] = group;

    const anchor = new THREE.Object3D();
    anchor.position.set(anchorPos[0], anchorPos[1], anchorPos[2]);
    group.add(anchor);
    anchors[id] = anchor;

    // Clone standard/physical materials uniquely per component
    const localCloneCache = new Map<THREE.Material, THREE.Material>();

    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
        obj.userData.componentId = id;
        // Skip transparent additive light cones from raycasting so clicking behind them works cleanly
        if (!obj.userData.nonClickable) {
          clickableMeshes.push(obj);
        }

        const processMat = (m: THREE.Material): THREE.Material => {
          if (localCloneCache.has(m)) {
            return localCloneCache.get(m)!;
          }
          const cloned = m.clone();
          clonedMaterialsToDispose.push(cloned);
          localCloneCache.set(m, cloned);

          if (
            cloned instanceof THREE.MeshStandardMaterial ||
            cloned instanceof THREE.MeshPhysicalMaterial
          ) {
            highlightMap[id].push({
              material: cloned,
              baseEmissive: cloned.emissive.clone(),
              baseEmissiveIntensity: cloned.emissiveIntensity,
              baseOpacity: cloned.opacity,
            });
            if (obj.userData.isLedEmitter) {
              ledEmitterMaterials.push(cloned);
            }
          } else if (cloned instanceof THREE.MeshBasicMaterial && obj.userData.isLedBeam) {
            ledBeamMaterials.push(cloned);
          }
          return cloned;
        };

        if (Array.isArray(obj.material)) {
          obj.material = obj.material.map(processMat);
        } else if (obj.material) {
          obj.material = processMat(obj.material);
        }
      }
    });

    const handle: AnimatedPartHandle = {
      object: group,
      assembledPosition: group.position.clone(),
      explodedOffset: new THREE.Vector3(...explodedOffset),
      assembledRotation: group.rotation.clone(),
      explodedRotationOffset: explodedRotationOffset
        ? new THREE.Euler(...explodedRotationOffset)
        : undefined,
    };
    animatedParts.push(handle);
    return handle;
  };

  // =========================================================================
  // 0. SHARED GROUNDED ALUMINUM CHASSIS BASEPLATE & GANTRY (Sits flush at Y=0)
  // =========================================================================
  const baseFrame = new THREE.Group();
  baseFrame.name = 'SharedBaseFrame';
  root.add(baseFrame);

  // Rubber anti-vibration leveling feet (4 corners, Y = 0 to 0.08)
  const footGeo = trackGeo(new THREE.CylinderGeometry(0.14, 0.16, 0.08, 18));
  const footCoords: [number, number][] = [
    [-2.75, -0.58],
    [-2.75, 0.62],
    [1.82, -0.58],
    [1.82, 0.62],
    [-0.95, 1.55],
    [1.65, 1.55],
  ];
  footCoords.forEach(([fx, fz]) => {
    const foot = new THREE.Mesh(footGeo, materials.rubberGasket);
    foot.position.set(fx, 0.04, fz);
    foot.castShadow = true;
    foot.receiveShadow = true;
    baseFrame.add(foot);
  });

  // Main horizontal base deck spanning enclosure mast & rhizobox chamber (Y = 0.08 to 0.22)
  const mainDeckGeo = trackGeo(createExtrudedRoundedBox(5.1, 0.14, 1.52, 0.12, 0.02));
  const mainDeck = new THREE.Mesh(mainDeckGeo, materials.anodizedFrame);
  mainDeck.position.set(-0.45, 0.15, 0.02);
  mainDeck.castShadow = true;
  mainDeck.receiveShadow = true;
  baseFrame.add(mainDeck);

  // Forward T-rail outrigger arms extending to support the optical camera/LED bridge (Y = 0.08 to 0.20)
  const outriggerGeo = trackGeo(createExtrudedRoundedBox(0.2, 0.12, 1.25, 0.04, 0.015));
  [-0.92, 1.62].forEach((ox) => {
    const arm = new THREE.Mesh(outriggerGeo, materials.anodizedFrame);
    arm.position.set(ox, 0.14, 1.12);
    arm.castShadow = true;
    arm.receiveShadow = true;
    baseFrame.add(arm);
  });

  // Vertical mounting mast bolted to left side of deck for the Electronics Enclosure
  const mastGeo = trackGeo(createExtrudedRoundedBox(0.18, 2.32, 0.18, 0.03, 0.015));
  const mast = new THREE.Mesh(mastGeo, materials.anodizedFrame);
  mast.position.set(-2.15, 1.36, -0.34);
  mast.castShadow = true;
  mast.receiveShadow = true;
  baseFrame.add(mast);

  // Gusset flange bolting mast to baseplate
  const gussetGeo = trackGeo(createExtrudedRoundedBox(0.46, 0.12, 0.42, 0.05, 0.015));
  const gusset = new THREE.Mesh(gussetGeo, materials.stainlessSteel);
  gusset.position.set(-2.15, 0.26, -0.34);
  baseFrame.add(gusset);

  // Horizontal aluminum tie-beam bracing enclosure mast to rhizobox frame
  const tieBeamGeo = trackGeo(new THREE.BoxGeometry(1.15, 0.1, 0.1));
  const tieBeam = new THREE.Mesh(tieBeamGeo, materials.anodizedFrame);
  tieBeam.position.set(-1.55, 1.48, -0.34);
  tieBeam.castShadow = true;
  baseFrame.add(tieBeam);

  // =========================================================================
  // 1. ROOT OBSERVATION CHAMBER (Center X = +0.35, Y = 0.22 to 2.74, Z = 0.1)
  // =========================================================================
  const chamberGroup = new THREE.Group();
  chamberGroup.position.set(0.35, 0, 0.0);
  root.add(chamberGroup);

  // Structural base tray sitting flush on mainDeck (Y = 0.22 to 0.32)
  const chamberTrayGeo = trackGeo(createExtrudedRoundedBox(2.68, 0.12, 1.06, 0.08, 0.018));
  const chamberTray = new THREE.Mesh(chamberTrayGeo, materials.anodizedFrame);
  chamberTray.position.set(0, 0.26, 0.08);
  chamberTray.castShadow = true;
  chamberTray.receiveShadow = true;
  chamberGroup.add(chamberTray);

  // Slotted vertical corner posts (4 posts framing the acrylic walls)
  const postGeo = trackGeo(createExtrudedRoundedBox(0.11, 2.38, 0.11, 0.02, 0.01));
  const postPositions: [number, number][] = [
    [-1.26, -0.36],
    [1.26, -0.36],
    [-1.26, 0.52],
    [1.26, 0.52],
  ];
  postPositions.forEach(([px, pz]) => {
    const post = new THREE.Mesh(postGeo, materials.anodizedFrame);
    post.position.set(px, 1.49, pz);
    post.castShadow = true;
    post.receiveShadow = true;
    chamberGroup.add(post);
  });

  // Top removable collar frame (open rectangular collar so crop & probes pass cleanly through)
  const collarShape = createRoundedFrameShape(2.68, 1.04, 2.32, 0.72, 0.08, 0.04);
  const collarGeo = trackGeo(
    new THREE.ExtrudeGeometry(collarShape, {
      depth: 0.11,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.015,
      bevelThickness: 0.015,
    }),
  );
  collarGeo.rotateX(Math.PI / 2);
  collarGeo.center();
  const topCollar = new THREE.Mesh(collarGeo, materials.anodizedFrame);
  topCollar.position.set(0, 2.66, 0.08);
  topCollar.castShadow = true;
  topCollar.receiveShadow = true;
  chamberGroup.add(topCollar);

  // Brass corner thumbscrews clamping top collar
  const thumbScrewGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.055, 0.08, 14));
  postPositions.forEach(([px, pz]) => {
    const screw = new THREE.Mesh(thumbScrewGeo, materials.brassHardware);
    screw.position.set(px, 2.75, pz);
    screw.castShadow = true;
    chamberGroup.add(screw);
  });

  // Dark contrast rear backing plate (Z = -0.36)
  const backplateGeo = trackGeo(new THREE.BoxGeometry(2.44, 2.32, 0.05));
  const backplate = new THREE.Mesh(backplateGeo, materials.chamberBackplate);
  backplate.position.set(0, 1.48, -0.36);
  backplate.castShadow = true;
  backplate.receiveShadow = true;
  chamberGroup.add(backplate);

  // Transparent left & right acrylic side panes
  const sidePaneGeo = trackGeo(new THREE.BoxGeometry(0.045, 2.3, 0.82));
  [-1.25, 1.25].forEach((sx) => {
    const pane = new THREE.Mesh(sidePaneGeo, materials.acrylicSide);
    pane.position.set(sx, 1.48, 0.08);
    pane.renderOrder = 8;
    chamberGroup.add(pane);
  });

  // Layered soil volume inside chamber (Y = 0.32 to 2.50, Z = -0.32 to +0.44)
  // Front soil face sits at Z = +0.44 so root branches at Z = 0.44..0.475 are crisp against the glass
  const soilBlockGeo = trackGeo(new THREE.BoxGeometry(2.38, 2.18, 0.76, 12, 12, 4));
  const soilPos = soilBlockGeo.attributes.position;
  for (let i = 0; i < soilPos.count; i++) {
    const y = soilPos.getY(i);
    if (y > 1.04) {
      // Natural organic mound undulation on top soil surface
      const x = soilPos.getX(i);
      const z = soilPos.getZ(i);
      const bump = Math.sin(x * 3.1) * 0.032 + Math.cos(z * 5.2) * 0.022;
      soilPos.setY(i, y + bump);
    }
  }
  soilBlockGeo.computeVertexNormals();
  const soilMesh = new THREE.Mesh(soilBlockGeo, materials.soilBody);
  soilMesh.position.set(0, 1.41, 0.06);
  soilMesh.receiveShadow = true;
  chamberGroup.add(soilMesh);

  // Crop seedling emerging from top soil crown (moves with chamber so it stays rooted in topsoil)
  const seedling = buildCropSeedling(materials.plantStem, materials.plantLeaf);
  chamberGroup.add(seedling);

  // Removable Front Acrylic Observation Window (separates forward slightly further during explode)
  const frontGlassPivot = new THREE.Group();
  frontGlassPivot.position.set(0, 1.48, 0.52);
  chamberGroup.add(frontGlassPivot);

  const frontPaneGeo = trackGeo(new THREE.BoxGeometry(2.44, 2.32, 0.05));
  const frontPane = new THREE.Mesh(frontPaneGeo, materials.acrylicWindow);
  frontPane.renderOrder = 10;
  frontGlassPivot.add(frontPane);

  // Beveled acrylic perimeter trim around observation window
  const windowBezelShape = createRoundedFrameShape(2.5, 2.38, 2.34, 2.22, 0.04, 0.02);
  const windowBezelGeo = trackGeo(
    new THREE.ExtrudeGeometry(windowBezelShape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.01,
      bevelThickness: 0.01,
    }),
  );
  windowBezelGeo.center();
  const windowBezel = new THREE.Mesh(windowBezelGeo, materials.anodizedFrame);
  windowBezel.position.z = 0.015;
  frontGlassPivot.add(windowBezel);

  // Etched depth-scale ruler decal plane sitting flush on outer surface of observation glass
  const rulerPlaneGeo = trackGeo(new THREE.PlaneGeometry(2.3, 2.18));
  const rulerMesh = new THREE.Mesh(rulerPlaneGeo, materials.rulerDecal);
  rulerMesh.position.z = 0.032;
  rulerMesh.renderOrder = 11;
  rulerMesh.userData.nonClickable = true;
  frontGlassPivot.add(rulerMesh);

  // Register front glass extra explode slide
  animatedParts.push({
    object: frontGlassPivot,
    assembledPosition: frontGlassPivot.position.clone(),
    explodedOffset: new THREE.Vector3(0, 0, 0.72),
  });

  registerComponent('root-chamber', chamberGroup, [1.28, 1.15, 0.56], [0.22, 0.0, -0.15]);

  // =========================================================================
  // 2. PROCEDURAL ROOT SYSTEM (Inside chamber, separates forward cleanly in Exploded View)
  // =========================================================================
  const rootSystemGroup = new THREE.Group();
  rootSystemGroup.position.set(0.35, 0, 0.0);
  const proceduralRoots = buildProceduralRootSystem(materials.rootPrimary, materials.rootFine);
  rootSystemGroup.add(proceduralRoots);
  root.add(rootSystemGroup);

  registerComponent('root-system', rootSystemGroup, [0.05, 1.25, 0.48], [0.22, 0.0, 0.65]);

  // =========================================================================
  // 3. MAIN ELECTRONICS HOUSING (Mounted on left mast: X = -2.15, Y = 1.85, Z = 0.0)
  // =========================================================================
  const enclosureGroup = new THREE.Group();
  enclosureGroup.position.set(-2.15, 1.85, 0.0);
  root.add(enclosureGroup);

  // Back wall + hollowed shell cavity so ESP32 genuinely sits INSIDE a recessed bay
  const encBackGeo = trackGeo(createExtrudedRoundedBox(1.32, 1.62, 0.14, 0.1, 0.025));
  const encBack = new THREE.Mesh(encBackGeo, materials.enclosureBody);
  encBack.position.z = -0.3;
  encBack.castShadow = true;
  encBack.receiveShadow = true;
  enclosureGroup.add(encBack);

  const encShellShape = createRoundedFrameShape(1.32, 1.62, 1.1, 1.38, 0.1, 0.05);
  const encShellGeo = trackGeo(
    new THREE.ExtrudeGeometry(encShellShape, {
      depth: 0.56,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.025,
      bevelThickness: 0.025,
    }),
  );
  encShellGeo.center();
  const encShell = new THREE.Mesh(encShellGeo, materials.enclosureBody);
  encShell.position.z = 0.02;
  encShell.castShadow = true;
  encShell.receiveShadow = true;
  enclosureGroup.add(encShell);

  // External molded reinforcement ribs on left exterior wall
  const ribGeo = trackGeo(new THREE.BoxGeometry(0.05, 1.18, 0.05));
  [-0.14, 0.02, 0.18].forEach((rz) => {
    const rib = new THREE.Mesh(ribGeo, materials.enclosureBody);
    rib.position.set(-0.67, 0, rz);
    enclosureGroup.add(rib);
  });

  // Mounting clamp brackets bolting housing to vertical mast at Z = -0.34
  const clampGeo = trackGeo(createExtrudedRoundedBox(0.42, 0.16, 0.28, 0.04, 0.015));
  [-0.48, 0.48].forEach((cy) => {
    const clamp = new THREE.Mesh(clampGeo, materials.anodizedFrame);
    clamp.position.set(0, cy, -0.38);
    clamp.castShadow = true;
    enclosureGroup.add(clamp);
  });

  // Silicone IP65 waterproof seal gasket around front rim
  const gasketShape = createRoundedFrameShape(1.22, 1.52, 1.12, 1.42, 0.08, 0.05);
  const gasketGeo = trackGeo(new THREE.ExtrudeGeometry(gasketShape, { depth: 0.03, bevelEnabled: false }));
  gasketGeo.center();
  const gasket = new THREE.Mesh(gasketGeo, materials.rubberGasket);
  gasket.position.z = 0.32;
  enclosureGroup.add(gasket);

  // 6 Waterproof PG7 Cable Glands on right & bottom-right walls
  const glandHexGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.055, 0.09, 6));
  glandHexGeo.rotateZ(Math.PI / 2);
  const glandNutGeo = trackGeo(new THREE.CylinderGeometry(0.042, 0.048, 0.08, 12));
  glandNutGeo.rotateZ(Math.PI / 2);

  const glandYs = [0.44, 0.24, 0.04, -0.16, -0.36, -0.54];
  glandYs.forEach((gy) => {
    const hex = new THREE.Mesh(glandHexGeo, materials.brassHardware);
    hex.position.set(0.69, gy, 0.04);
    enclosureGroup.add(hex);

    const nut = new THREE.Mesh(glandNutGeo, materials.darkPolymer);
    nut.position.set(0.76, gy, 0.04);
    enclosureGroup.add(nut);
  });

  // Removable Front Lid sub-group (with recessed clear inspection window + 4 corner fasteners)
  const lidGroup = new THREE.Group();
  lidGroup.position.set(0, 0, 0.38);
  enclosureGroup.add(lidGroup);

  const lidFrameShape = createRoundedFrameShape(1.36, 1.66, 0.86, 1.12, 0.11, 0.05);
  const lidFrameGeo = trackGeo(
    new THREE.ExtrudeGeometry(lidFrameShape, {
      depth: 0.09,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.02,
      bevelThickness: 0.02,
    }),
  );
  lidFrameGeo.center();
  const lidFrame = new THREE.Mesh(lidFrameGeo, materials.enclosureLid);
  lidFrame.castShadow = true;
  lidFrame.receiveShadow = true;
  lidGroup.add(lidFrame);

  // Polycarbonate clear lid inspection window so ESP32 is visible even when assembled
  const lidGlassGeo = trackGeo(new THREE.BoxGeometry(0.88, 1.14, 0.03));
  const lidGlass = new THREE.Mesh(lidGlassGeo, materials.lidWindow);
  lidGlass.renderOrder = 9;
  lidGlass.userData.nonClickable = true; // Lets clicks through to the ESP32 PCB inside!
  lidGroup.add(lidGlass);

  // 4 stainless-steel hex socket cap screws at lid corners
  const lidBoltGeo = trackGeo(new THREE.CylinderGeometry(0.042, 0.042, 0.05, 6));
  lidBoltGeo.rotateX(Math.PI / 2);
  const lidBoltPos: [number, number][] = [
    [-0.53, 0.67],
    [0.53, 0.67],
    [-0.53, -0.67],
    [0.53, -0.67],
  ];
  lidBoltPos.forEach(([bx, by]) => {
    const bolt = new THREE.Mesh(lidBoltGeo, materials.stainlessSteel);
    bolt.position.set(bx, by, 0.065);
    lidGroup.add(bolt);
  });

  // External weatherproof antenna bulkhead mount on top of enclosure
  const antBaseGeo = trackGeo(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 12));
  const antBase = new THREE.Mesh(antBaseGeo, materials.brassHardware);
  antBase.position.set(0.32, 0.84, 0.0);
  enclosureGroup.add(antBase);

  registerComponent('enclosure', enclosureGroup, [-0.55, 0.88, 0.15], [-0.88, 0.12, -0.2]);

  // Dedicated lid animation handle (opens during Exploded View OR when ESP32 is focused/demo Step 9)
  const lidPart: AnimatedPartHandle = {
    object: lidGroup,
    assembledPosition: lidGroup.position.clone(),
    explodedOffset: new THREE.Vector3(-0.78, 0.08, 0.92),
    assembledRotation: lidGroup.rotation.clone(),
    explodedRotationOffset: new THREE.Euler(0, -0.32, 0),
  };

  // =========================================================================
  // 4. ESP32 MICROCONTROLLER MODULE (Inside enclosure at X = -2.15, Y = 1.85, Z = 0.06)
  // =========================================================================
  const esp32Group = new THREE.Group();
  esp32Group.position.set(-2.15, 1.85, 0.04);
  root.add(esp32Group);

  // 4 brass PCB mounting standoffs connecting to enclosure backplate
  const standoffGeo = trackGeo(new THREE.CylinderGeometry(0.028, 0.028, 0.24, 6));
  standoffGeo.rotateX(Math.PI / 2);
  const standoffCoords: [number, number][] = [
    [-0.31, 0.54],
    [0.31, 0.54],
    [-0.31, -0.54],
    [0.31, -0.54],
  ];
  standoffCoords.forEach(([sx, sy]) => {
    const so = new THREE.Mesh(standoffGeo, materials.brassHardware);
    so.position.set(sx, sy, -0.14);
    esp32Group.add(so);
  });

  // Main ESP32 PCB substrate with procedural silkscreen & trace texture
  const pcbGeo = trackGeo(new THREE.BoxGeometry(0.72, 1.22, 0.045));
  const pcbMesh = new THREE.Mesh(pcbGeo, materials.pcbBoard);
  pcbMesh.castShadow = true;
  pcbMesh.receiveShadow = true;
  esp32Group.add(pcbMesh);

  // Brushed metallic ESP32-WROOM RF Shield Can
  const shieldGeo = trackGeo(createExtrudedRoundedBox(0.42, 0.44, 0.085, 0.02, 0.008));
  const shieldMesh = new THREE.Mesh(shieldGeo, materials.rfShield);
  shieldMesh.position.set(0, 0.2, 0.062);
  shieldMesh.castShadow = true;
  esp32Group.add(shieldMesh);

  // Dual-row gold header pins (30 pins via InstancedMesh for high-performance geometry)
  const pinCount = 30;
  const pinGeo = trackGeo(new THREE.BoxGeometry(0.018, 0.018, 0.12));
  const headerPins = new THREE.InstancedMesh(pinGeo, materials.goldPin, pinCount);
  const dummy = new THREE.Object3D();
  let pinIdx = 0;
  for (let side = 0; side < 2; side++) {
    const px = side === 0 ? -0.3 : 0.3;
    for (let i = 0; i < 15; i++) {
      const py = 0.36 - i * 0.056;
      dummy.position.set(px, py, 0.06);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      headerPins.setMatrixAt(pinIdx++, dummy.matrix);
    }
  }
  headerPins.instanceMatrix.needsUpdate = true;
  headerPins.computeBoundingSphere();
  esp32Group.add(headerPins);

  // Plastic header strips framing the pins
  const stripGeo = trackGeo(new THREE.BoxGeometry(0.05, 0.86, 0.045));
  [-0.3, 0.3].forEach((sx) => {
    const strip = new THREE.Mesh(stripGeo, materials.darkPolymer);
    strip.position.set(sx, -0.03, 0.042);
    esp32Group.add(strip);
  });

  // USB-C brushed metal receptacle at bottom edge of PCB
  const usbGeo = trackGeo(createExtrudedRoundedBox(0.18, 0.12, 0.07, 0.025, 0.006));
  const usbMesh = new THREE.Mesh(usbGeo, materials.stainlessSteel);
  usbMesh.position.set(0, -0.57, 0.055);
  esp32Group.add(usbMesh);

  // Tactile EN & BOOT micro-switches + voltage regulator IC
  const btnGeo = trackGeo(new THREE.BoxGeometry(0.065, 0.045, 0.04));
  [-0.17, 0.17].forEach((bx) => {
    const btn = new THREE.Mesh(btnGeo, materials.stainlessSteel);
    btn.position.set(bx, -0.5, 0.042);
    esp32Group.add(btn);
  });

  const icGeo = trackGeo(new THREE.BoxGeometry(0.13, 0.13, 0.032));
  const icMesh = new THREE.Mesh(icGeo, materials.darkPolymer);
  icMesh.position.set(0.0, -0.28, 0.038);
  esp32Group.add(icMesh);

  // External articulating stubby Wi-Fi dipole antenna connected to the top RF port
  const smaConnectorGeo = trackGeo(new THREE.CylinderGeometry(0.032, 0.036, 0.12, 12));
  const smaConn = new THREE.Mesh(smaConnectorGeo, materials.brassHardware);
  smaConn.position.set(0.32, 0.84, -0.04);
  esp32Group.add(smaConn);

  const antennaMastGeo = trackGeo(new THREE.CylinderGeometry(0.026, 0.036, 0.62, 14));
  const antennaMast = new THREE.Mesh(antennaMastGeo, materials.darkPolymer);
  antennaMast.position.set(0.32, 1.2, -0.04);
  antennaMast.castShadow = true;
  esp32Group.add(antennaMast);

  const antennaTipGeo = trackGeo(new THREE.SphereGeometry(0.026, 12, 10));
  const antennaTip = new THREE.Mesh(antennaTipGeo, materials.darkPolymer);
  antennaTip.position.set(0.32, 1.51, -0.04);
  esp32Group.add(antennaTip);

  // Coax jumper inside enclosure linking PCB top antenna pad to SMA mast
  const coaxJump = createCurvedCable(
    [
      new THREE.Vector3(0.16, 0.56, 0.03),
      new THREE.Vector3(0.28, 0.68, 0.0),
      new THREE.Vector3(0.32, 0.8, -0.04),
    ],
    0.015,
    materials.cableJacket,
  );
  esp32Group.add(coaxJump);

  const esp32Part = registerComponent(
    'esp32',
    esp32Group,
    [0.0, 0.15, 0.14],
    [-0.18, 0.12, 0.92],
  );

  // =========================================================================
  // 5. ROOT CAMERA ASSEMBLY (Mounted on forward optical bridge at Z = +1.48, facing -Z)
  // =========================================================================
  const cameraGroup = new THREE.Group();
  cameraGroup.position.set(0.35, 0, 0.0);
  root.add(cameraGroup);

  // Rigid anodized vertical risers & crossbar anchored solidly to the forward outrigger arms
  const riserGeo = trackGeo(createExtrudedRoundedBox(0.11, 1.38, 0.11, 0.02, 0.01));
  [-1.27, 1.27].forEach((rx) => {
    const riser = new THREE.Mesh(riserGeo, materials.anodizedFrame);
    riser.position.set(rx, 0.86, 1.48);
    riser.castShadow = true;
    cameraGroup.add(riser);
  });

  const crossbarGeo = trackGeo(createExtrudedRoundedBox(2.68, 0.1, 0.1, 0.02, 0.01));
  const crossbar = new THREE.Mesh(crossbarGeo, materials.anodizedFrame);
  crossbar.position.set(0, 1.48, 1.48);
  crossbar.castShadow = true;
  cameraGroup.add(crossbar);

  // Gimbal clamp saddle + locking brass knob
  const yokeGeo = trackGeo(createExtrudedRoundedBox(0.34, 0.24, 0.2, 0.03, 0.012));
  const yoke = new THREE.Mesh(yokeGeo, materials.anodizedFrame);
  yoke.position.set(0, 1.48, 1.48);
  cameraGroup.add(yoke);

  const lockKnobGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.055, 0.09, 14));
  const lockKnob = new THREE.Mesh(lockKnobGeo, materials.brassHardware);
  lockKnob.position.set(0, 1.65, 1.48);
  cameraGroup.add(lockKnob);

  // Machined aluminum camera module body with side heatsink fins
  const camHousingGeo = trackGeo(createExtrudedRoundedBox(0.48, 0.38, 0.34, 0.05, 0.02));
  const camHousing = new THREE.Mesh(camHousingGeo, materials.cameraBody);
  camHousing.position.set(0, 1.48, 1.38);
  camHousing.castShadow = true;
  cameraGroup.add(camHousing);

  // Heatsink cooling fins on back of camera housing
  const finGeo = trackGeo(new THREE.BoxGeometry(0.4, 0.02, 0.05));
  for (let f = -2; f <= 2; f++) {
    const fin = new THREE.Mesh(finGeo, materials.anodizedFrame);
    fin.position.set(0, 1.48 + f * 0.06, 1.56);
    cameraGroup.add(fin);
  }

  // Multi-element LatheGeometry optical lens barrel facing -Z toward root window
  const lensProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.16, 0.0),
    new THREE.Vector2(0.16, 0.07),
    new THREE.Vector2(0.145, 0.085),
    new THREE.Vector2(0.145, 0.16),
    new THREE.Vector2(0.132, 0.175),
    new THREE.Vector2(0.132, 0.22),
    new THREE.Vector2(0.11, 0.22),
    new THREE.Vector2(0.105, 0.17),
    new THREE.Vector2(0.0, 0.17),
  ];
  const lensBarrelGeo = trackGeo(new THREE.LatheGeometry(lensProfile, 28));
  lensBarrelGeo.rotateX(-Math.PI / 2);
  const lensBarrel = new THREE.Mesh(lensBarrelGeo, materials.cameraBody);
  lensBarrel.position.set(0, 1.48, 1.22);
  lensBarrel.castShadow = true;
  cameraGroup.add(lensBarrel);

  // Anodized leaf-green accent focus ring around lens barrel
  const focusRingGeo = trackGeo(new THREE.TorusGeometry(0.148, 0.012, 10, 28));
  const focusRing = new THREE.Mesh(focusRingGeo, materials.ecAccent);
  focusRing.position.set(0, 1.48, 1.11);
  cameraGroup.add(focusRing);

  // Anti-reflective curved sapphire glass optical element
  const lensGlassGeo = trackGeo(new THREE.SphereGeometry(0.104, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.36));
  lensGlassGeo.rotateX(-Math.PI / 2);
  const lensGlass = new THREE.Mesh(lensGlassGeo, materials.opticalLens);
  lensGlass.position.set(0, 1.48, 1.07);
  cameraGroup.add(lensGlass);

  // Shielded camera cable routing cleanly along left riser back toward enclosure
  const camCable = createCurvedCable(
    [
      new THREE.Vector3(-0.22, 1.44, 1.44),
      new THREE.Vector3(-1.26, 1.44, 1.44),
      new THREE.Vector3(-1.34, 1.38, 0.65),
      new THREE.Vector3(-1.74, 1.32, 0.04),
    ],
    0.022,
    materials.cableJacket,
  );
  cameraGroup.add(camCable);

  registerComponent('camera', cameraGroup, [0.0, 1.48, 1.56], [0.22, -0.05, 1.35]);

  // =========================================================================
  // 6. LED ILLUMINATION MODULE (Dual angled bars flanking camera on optical bridge)
  // =========================================================================
  const ledsGroup = new THREE.Group();
  ledsGroup.position.set(0.35, 0, 0.0);
  root.add(ledsGroup);

  const ledBarBodyGeo = trackGeo(createExtrudedRoundedBox(0.13, 0.92, 0.1, 0.025, 0.012));
  const ledClampGeo = trackGeo(createExtrudedRoundedBox(0.16, 0.14, 0.18, 0.02, 0.01));
  const smdGeo = trackGeo(new THREE.CylinderGeometry(0.028, 0.032, 0.024, 12));
  smdGeo.rotateX(Math.PI / 2);
  const beamGeo = trackGeo(new THREE.ConeGeometry(0.56, 1.02, 20, 1, true));
  beamGeo.rotateX(Math.PI / 2);

  [-0.78, 0.78].forEach((lx) => {
    const barPivot = new THREE.Group();
    barPivot.position.set(lx, 1.48, 1.38);
    // Angle inward toward the center of the root observation window
    barPivot.rotation.y = lx < 0 ? 0.24 : -0.24;

    const barBody = new THREE.Mesh(ledBarBodyGeo, materials.ledHousing);
    barBody.castShadow = true;
    barPivot.add(barBody);

    const railBracket = new THREE.Mesh(ledClampGeo, materials.anodizedFrame);
    railBracket.position.set(0, 0, 0.09);
    barPivot.add(railBracket);

    // 4 visible warm-neutral SMD LED emitters per bar
    for (let e = 0; e < 4; e++) {
      const ey = -0.3 + e * 0.2;
      const emitter = new THREE.Mesh(smdGeo, materials.ledEmitter);
      emitter.position.set(0, ey, -0.052);
      emitter.userData.isLedEmitter = true;
      barPivot.add(emitter);
    }

    // Subtle volumetric illumination cone toward the rhizobox window
    const beam = new THREE.Mesh(beamGeo, materials.ledBeam);
    beam.position.set(0, 0, -0.56);
    beam.scale.set(0.75, 1.35, 1.0);
    beam.renderOrder = 14;
    beam.userData.nonClickable = true;
    beam.userData.isLedBeam = true;
    barPivot.add(beam);

    ledsGroup.add(barPivot);
  });

  // LED power cable running along top of crossbar toward enclosure
  const ledCable = createCurvedCable(
    [
      new THREE.Vector3(0.78, 1.54, 1.46),
      new THREE.Vector3(0.0, 1.56, 1.51),
      new THREE.Vector3(-0.78, 1.54, 1.46),
      new THREE.Vector3(-1.32, 1.52, 0.72),
      new THREE.Vector3(-1.74, 1.48, 0.04),
    ],
    0.017,
    materials.cableJacket,
  );
  ledsGroup.add(ledCable);

  registerComponent('leds', ledsGroup, [-0.78, 1.88, 1.38], [0.22, 0.26, 1.1]);

  // =========================================================================
  // 7. SOIL MOISTURE SENSOR 1 — SHALLOW ZONE (X = -0.32 local, upper root zone Y=1.78..2.68)
  // =========================================================================
  const moist1Group = new THREE.Group();
  moist1Group.position.set(0.35 - 0.34, 0, 0.18);
  root.add(moist1Group);

  // Molded waterproof epoxy sensor head above soil surface
  const m1HeadGeo = trackGeo(createExtrudedRoundedBox(0.22, 0.28, 0.11, 0.035, 0.015));
  const m1Head = new THREE.Mesh(m1HeadGeo, materials.moistureHead);
  m1Head.position.set(0, 2.66, 0);
  m1Head.castShadow = true;
  moist1Group.add(m1Head);

  // Depth collar & twin capacitive sensing tines reaching upper root zone (Y = 1.78 to 2.52)
  const m1CollarGeo = trackGeo(new THREE.BoxGeometry(0.24, 0.05, 0.13));
  const m1Collar = new THREE.Mesh(m1CollarGeo, materials.darkPolymer);
  m1Collar.position.set(0, 2.51, 0);
  moist1Group.add(m1Collar);

  const m1BladeGeo = trackGeo(new THREE.BoxGeometry(0.042, 0.74, 0.022));
  const m1TipGeo = trackGeo(new THREE.ConeGeometry(0.024, 0.08, 4));
  m1TipGeo.rotateX(Math.PI);
  m1TipGeo.rotateY(Math.PI / 4);
  [-0.055, 0.055].forEach((bx) => {
    const blade = new THREE.Mesh(m1BladeGeo, materials.moistureBlade);
    blade.position.set(bx, 2.13, 0);
    moist1Group.add(blade);

    const goldTrace = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.014, 0.64, 0.026)),
      materials.goldPin,
    );
    goldTrace.position.set(bx, 2.13, 0);
    moist1Group.add(goldTrace);

    const tip = new THREE.Mesh(m1TipGeo, materials.moistureBlade);
    tip.position.set(bx, 1.72, 0);
    moist1Group.add(tip);
  });

  // Curved probe cable routing cleanly to top gland on electronics housing
  const m1Cable = createCurvedCable(
    [
      new THREE.Vector3(0, 2.8, 0),
      new THREE.Vector3(-0.35, 3.04, -0.05),
      new THREE.Vector3(-1.12, 2.72, -0.12),
      new THREE.Vector3(-1.38, 2.29, -0.14),
    ],
    0.016,
    materials.cableJacket,
  );
  moist1Group.add(m1Cable);

  registerComponent('moisture-1', moist1Group, [0, 2.68, 0.06], [-0.18, 0.85, 0.22]);

  // =========================================================================
  // 8. SOIL MOISTURE SENSOR 2 — DEEP ZONE (X = +0.86 local, deep subsoil Y=0.62..2.68)
  // =========================================================================
  const moist2Group = new THREE.Group();
  moist2Group.position.set(0.35 + 0.84, 0, 0.14);
  root.add(moist2Group);

  const m2HeadGeo = trackGeo(createExtrudedRoundedBox(0.24, 0.3, 0.12, 0.035, 0.015));
  const m2Head = new THREE.Mesh(m2HeadGeo, materials.moistureDeepHead);
  m2Head.position.set(0, 2.68, 0);
  m2Head.castShadow = true;
  moist2Group.add(m2Head);

  // Extended insulated depth shaft down to deep root zone (Y = 1.38 to 2.54)
  const m2ShaftGeo = trackGeo(new THREE.CylinderGeometry(0.038, 0.038, 1.18, 12));
  const m2Shaft = new THREE.Mesh(m2ShaftGeo, materials.darkPolymer);
  m2Shaft.position.set(0, 1.94, 0);
  moist2Group.add(m2Shaft);

  // Depth calibration marker rings
  const ringGeo = trackGeo(new THREE.TorusGeometry(0.044, 0.008, 8, 16));
  ringGeo.rotateX(Math.PI / 2);
  [2.32, 1.88, 1.44].forEach((ry) => {
    const ring = new THREE.Mesh(ringGeo, materials.brassHardware);
    ring.position.set(0, ry, 0);
    moist2Group.add(ring);
  });

  // Lower manifold + deep dual sensing prongs (Y = 0.62 to 1.36)
  const m2Manifold = new THREE.Mesh(
    trackGeo(createExtrudedRoundedBox(0.2, 0.1, 0.09, 0.02, 0.008)),
    materials.moistureDeepHead,
  );
  m2Manifold.position.set(0, 1.34, 0);
  moist2Group.add(m2Manifold);

  const m2ProngGeo = trackGeo(new THREE.CylinderGeometry(0.018, 0.012, 0.72, 10));
  [-0.055, 0.055].forEach((px) => {
    const prong = new THREE.Mesh(m2ProngGeo, materials.stainlessSteel);
    prong.position.set(px, 0.96, 0);
    moist2Group.add(prong);
  });

  const m2Cable = createCurvedCable(
    [
      new THREE.Vector3(0, 2.83, 0),
      new THREE.Vector3(-0.32, 3.16, -0.18),
      new THREE.Vector3(-1.68, 2.94, -0.26),
      new THREE.Vector3(-2.56, 2.09, -0.1),
    ],
    0.016,
    materials.cableJacket,
  );
  moist2Group.add(m2Cable);

  registerComponent('moisture-2', moist2Group, [0.06, 1.25, 0.06], [0.95, 0.45, 0.08]);

  // =========================================================================
  // 9. SOIL TEMPERATURE SENSOR (Stainless steel probe at X = -0.86 local, mid zone)
  // =========================================================================
  const tempGroup = new THREE.Group();
  tempGroup.position.set(0.35 - 0.86, 0, 0.22);
  root.add(tempGroup);

  // Anodized top grommet & heat-shrink strain relief
  const tempCapGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.065, 0.24, 14));
  const tempCap = new THREE.Mesh(tempCapGeo, materials.darkPolymer);
  tempCap.position.set(0, 2.66, 0);
  tempCap.castShadow = true;
  tempGroup.add(tempCap);

  // Insulated lead shaft into mid root zone
  const tempShaftGeo = trackGeo(new THREE.CylinderGeometry(0.026, 0.026, 1.05, 12));
  const tempShaft = new THREE.Mesh(tempShaftGeo, materials.cableJacket);
  tempShaft.position.set(0, 2.04, 0);
  tempGroup.add(tempShaft);

  // 316L stainless steel bullet-tip thermal probe capsule (LatheGeometry)
  const tempProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.042, 0.04),
    new THREE.Vector2(0.048, 0.12),
    new THREE.Vector2(0.048, 0.48),
    new THREE.Vector2(0.036, 0.52),
    new THREE.Vector2(0.0, 0.52),
  ];
  const tempTipGeo = trackGeo(new THREE.LatheGeometry(tempProfile, 20));
  const tempTip = new THREE.Mesh(tempTipGeo, materials.stainlessSteel);
  tempTip.position.set(0, 1.08, 0);
  tempTip.castShadow = true;
  tempGroup.add(tempTip);

  const tempCable = createCurvedCable(
    [
      new THREE.Vector3(0, 2.78, 0),
      new THREE.Vector3(-0.34, 2.86, -0.04),
      new THREE.Vector3(-0.72, 2.48, -0.14),
      new THREE.Vector3(-0.86, 1.89, -0.18),
    ],
    0.015,
    materials.cableJacket,
  );
  tempGroup.add(tempCable);

  registerComponent('temp-sensor', tempGroup, [-0.04, 1.48, 0.05], [-0.88, 0.58, 0.28]);

  // =========================================================================
  // 10. EC SENSOR — ELECTRICAL CONDUCTIVITY (X = +0.50 local, mid-right zone)
  // =========================================================================
  const ecGroup = new THREE.Group();
  ecGroup.position.set(0.35 + 0.5, 0, 0.24);
  root.add(ecGroup);

  // Waterproof BNC cap & cyan-slate ID band
  const ecCapGeo = trackGeo(new THREE.CylinderGeometry(0.068, 0.075, 0.22, 16));
  const ecCap = new THREE.Mesh(ecCapGeo, materials.ecBody);
  ecCap.position.set(0, 2.68, 0);
  ecCap.castShadow = true;
  ecGroup.add(ecCap);

  const ecBandGeo = trackGeo(new THREE.CylinderGeometry(0.077, 0.077, 0.06, 16));
  const ecBand = new THREE.Mesh(ecBandGeo, materials.ecAccent);
  ecBand.position.set(0, 2.62, 0);
  ecGroup.add(ecBand);

  // Main cylindrical PEEK probe body
  const ecBodyGeo = trackGeo(new THREE.CylinderGeometry(0.064, 0.064, 1.24, 16));
  const ecBodyMesh = new THREE.Mesh(ecBodyGeo, materials.ecBody);
  ecBodyMesh.position.set(0, 1.94, 0);
  ecBodyMesh.castShadow = true;
  ecGroup.add(ecBodyMesh);

  // Lower slotted shroud frame exposing twin platinum/graphite conductivity electrodes
  const ecShroudRingGeo = trackGeo(new THREE.TorusGeometry(0.062, 0.012, 8, 16));
  ecShroudRingGeo.rotateX(Math.PI / 2);
  const ecLowerRing = new THREE.Mesh(ecShroudRingGeo, materials.ecBody);
  ecLowerRing.position.set(0, 1.06, 0);
  ecGroup.add(ecLowerRing);

  const strutGeo = trackGeo(new THREE.BoxGeometry(0.016, 0.28, 0.016));
  [0, Math.PI * 0.66, Math.PI * 1.33].forEach((ang) => {
    const strut = new THREE.Mesh(strutGeo, materials.ecBody);
    strut.position.set(Math.cos(ang) * 0.056, 1.2, Math.sin(ang) * 0.056);
    ecGroup.add(strut);
  });

  // Two parallel platinum-steel conductivity electrode rods inside shroud
  const ecPinGeo = trackGeo(new THREE.CylinderGeometry(0.014, 0.014, 0.24, 12));
  [-0.025, 0.025].forEach((ex) => {
    const pin = new THREE.Mesh(ecPinGeo, materials.stainlessSteel);
    pin.position.set(ex, 1.21, 0);
    ecGroup.add(pin);
  });

  const ecCable = createCurvedCable(
    [
      new THREE.Vector3(0, 2.79, 0),
      new THREE.Vector3(-0.26, 3.08, -0.06),
      new THREE.Vector3(-1.35, 2.86, -0.18),
      new THREE.Vector3(-2.22, 1.69, -0.2),
    ],
    0.016,
    materials.cableJacket,
  );
  ecGroup.add(ecCable);

  registerComponent('ec-sensor', ecGroup, [0.04, 2.1, 0.08], [0.65, 0.88, 0.35]);

  // =========================================================================
  // 11. pH SENSOR (X = -0.58 local, mid-left rear root column)
  // =========================================================================
  const phGroup = new THREE.Group();
  phGroup.position.set(0.35 - 0.58, 0, -0.06);
  root.add(phGroup);

  const phCapGeo = trackGeo(new THREE.CylinderGeometry(0.064, 0.072, 0.24, 16));
  const phCap = new THREE.Mesh(phCapGeo, materials.phBody);
  phCap.position.set(0, 2.68, 0);
  phCap.castShadow = true;
  phGroup.add(phCap);

  const phBandGeo = trackGeo(new THREE.CylinderGeometry(0.074, 0.074, 0.065, 16));
  const phBand = new THREE.Mesh(phBandGeo, materials.phAccent);
  phBand.position.set(0, 2.62, 0);
  phGroup.add(phBand);

  const phShaftGeo = trackGeo(new THREE.CylinderGeometry(0.056, 0.052, 1.48, 16));
  const phShaft = new THREE.Mesh(phShaftGeo, materials.phBody);
  phShaft.position.set(0, 1.82, 0);
  phShaft.castShadow = true;
  phGroup.add(phShaft);

  // Porous ceramic reference junction band
  const ceramicRingGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 16));
  const ceramicRing = new THREE.Mesh(ceramicRingGeo, materials.rootFine);
  ceramicRing.position.set(0, 1.16, 0);
  phGroup.add(ceramicRing);

  // Translucent glass sensing bulb at tip inside spear guard prongs
  const phBulbGeo = trackGeo(new THREE.SphereGeometry(0.042, 18, 14));
  const phBulb = new THREE.Mesh(phBulbGeo, materials.phGlassBulb);
  phBulb.position.set(0, 1.04, 0);
  phGroup.add(phBulb);

  // Protective slotted spear guard prongs
  const guardGeo = trackGeo(new THREE.ConeGeometry(0.012, 0.16, 6));
  guardGeo.rotateX(Math.PI);
  [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].forEach((ang) => {
    const gProng = new THREE.Mesh(guardGeo, materials.phBody);
    gProng.position.set(Math.cos(ang) * 0.048, 1.02, Math.sin(ang) * 0.048);
    phGroup.add(gProng);
  });

  const phCable = createCurvedCable(
    [
      new THREE.Vector3(0, 2.8, 0),
      new THREE.Vector3(-0.34, 3.0, -0.02),
      new THREE.Vector3(-0.92, 2.62, 0.02),
      new THREE.Vector3(-1.14, 1.69, 0.1),
    ],
    0.016,
    materials.cableJacket,
  );
  phGroup.add(phCable);

  registerComponent('ph-sensor', phGroup, [-0.05, 2.0, 0.0], [-0.52, 1.08, -0.45]);

  // =========================================================================
  // 12. EXPERIMENTAL IMPEDANCE ELECTRODES (Paired copper-gold rods bracketing root zone)
  // =========================================================================
  const impedanceGroup = new THREE.Group();
  impedanceGroup.position.set(0.35 + 0.02, 0, 0.12);
  root.add(impedanceGroup);

  const electrodeXOffsets = [-0.22, 0.26];
  const rodGeo = trackGeo(new THREE.CylinderGeometry(0.022, 0.016, 1.62, 14));
  const rodTipGeo = trackGeo(new THREE.ConeGeometry(0.016, 0.08, 12));
  rodTipGeo.rotateX(Math.PI);
  const collarInsulatorGeo = trackGeo(new THREE.CylinderGeometry(0.046, 0.052, 0.18, 14));
  const terminalHeadGeo = trackGeo(new THREE.CylinderGeometry(0.036, 0.036, 0.12, 12));

  electrodeXOffsets.forEach((ex) => {
    // Precision copper-gold sensing rod extending through root-soil cross section
    const rod = new THREE.Mesh(rodGeo, materials.copperElectrode);
    rod.position.set(ex, 1.72, 0);
    rod.castShadow = true;
    impedanceGroup.add(rod);

    const tip = new THREE.Mesh(rodTipGeo, materials.goldPin);
    tip.position.set(ex, 0.87, 0);
    impedanceGroup.add(tip);

    // Distinct amber experimental ceramic insulator collar above soil line
    const collar = new THREE.Mesh(collarInsulatorGeo, materials.impedanceCollar);
    collar.position.set(ex, 2.62, 0);
    collar.castShadow = true;
    impedanceGroup.add(collar);

    // Differential measurement terminal binding post
    const terminal = new THREE.Mesh(terminalHeadGeo, materials.brassHardware);
    terminal.position.set(ex, 2.77, 0);
    impedanceGroup.add(terminal);
  });

  // Experimental differential bridge bar & shielded twisted lead connecting the pair
  const bridgeBar = createCurvedCable(
    [
      new THREE.Vector3(-0.22, 2.82, 0),
      new THREE.Vector3(0.02, 2.94, 0.02),
      new THREE.Vector3(0.26, 2.82, 0),
    ],
    0.014,
    materials.impedanceCollar,
  );
  impedanceGroup.add(bridgeBar);

  const impCable = createCurvedCable(
    [
      new THREE.Vector3(0.02, 2.94, 0.02),
      new THREE.Vector3(-0.48, 3.18, -0.06),
      new THREE.Vector3(-1.42, 2.82, -0.1),
      new THREE.Vector3(-1.74, 1.49, -0.08),
    ],
    0.016,
    materials.cableJacket,
  );
  impedanceGroup.add(impCable);

  registerComponent('impedance', impedanceGroup, [0.26, 2.66, 0.05], [0.22, 1.24, 0.12]);

  // =========================================================================
  // HIGHLIGHT & LED INTENSITY STATE MANAGEMENT
  // =========================================================================
  const HIGHLIGHT_GREEN = new THREE.Color(0x3cb878);
  const HIGHLIGHT_AMBER = new THREE.Color(0xd99230);
  const HOVER_TINT = new THREE.Color(0x286e4a);

  const setHighlightState = (
    selectedId: ComponentId | null,
    highlightedIds: ComponentId[],
    hoveredId: ComponentId | null,
  ) => {
    const activeSet = new Set<ComponentId>(highlightedIds);
    if (selectedId) activeSet.add(selectedId);

    (Object.keys(highlightMap) as ComponentId[]).forEach((id) => {
      const entries = highlightMap[id];
      const isActive = activeSet.has(id);
      const isHovered = hoveredId === id;
      const highlightColor = id === 'impedance' ? HIGHLIGHT_AMBER : HIGHLIGHT_GREEN;

      entries.forEach((entry) => {
        if (isActive) {
          entry.material.emissive.copy(entry.baseEmissive).lerp(highlightColor, 0.72);
          entry.material.emissiveIntensity = Math.max(entry.baseEmissiveIntensity + 0.42, 0.52);
        } else if (isHovered) {
          entry.material.emissive.copy(entry.baseEmissive).lerp(HOVER_TINT, 0.48);
          entry.material.emissiveIntensity = Math.max(entry.baseEmissiveIntensity + 0.18, 0.24);
        } else {
          entry.material.emissive.copy(entry.baseEmissive);
          entry.material.emissiveIntensity = entry.baseEmissiveIntensity;
        }
      });
    });
  };

  const setLedBoost = (boost: number) => {
    const clamped = THREE.MathUtils.clamp(boost, 0, 1);
    ledBeamMaterials.forEach((bm) => {
      bm.opacity = 0.06 + clamped * 0.22;
    });
    ledEmitterMaterials.forEach((em) => {
      em.emissiveIntensity = 0.85 + clamped * 1.9;
    });
  };

  setLedBoost(0.35);

  return {
    root,
    componentGroups,
    anchors,
    animatedParts,
    lidPart,
    esp32Part,
    clickableMeshes,
    ledBeamMaterials,
    ledEmitterMaterials,
    setHighlightState,
    setLedBoost,
    dispose: () => {
      geometriesToDispose.forEach((g) => g.dispose());
      clonedMaterialsToDispose.forEach((m) => m.dispose());
      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.geometry) {
          obj.geometry.dispose();
        }
      });
    },
  };
}
