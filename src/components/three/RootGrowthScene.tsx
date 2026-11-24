import { Eye, EyeOff, Pause, Play, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useApp } from '../../i18n/LanguageContext';
import {
  applyStudioEnvironmentAndLights,
  createAfterDraw,
  createContactShadowTexture,
  createSoilStrataTextures,
  createStudioRenderer,
  detectSoftwareGl,
} from './threeUtils';

interface RootSegmentMeta {
  mesh: THREE.Mesh;
  startAt: number;
  endAt: number;
  fullIndices: number;
}

interface RootGrowthSceneProps {
  compact?: boolean;
}

export function RootGrowthScene({ compact = false }: RootGrowthSceneProps) {
  const { t } = useApp();
  const mountRef = useRef<HTMLDivElement | null>(null);

  const [soilVisible, setSoilVisible] = useState(true);
  const [rootsVisible, setRootsVisible] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [growthProgress, setGrowthProgress] = useState(72);
  const [dockOpen, setDockOpen] = useState(true);
  const [webglError, setWebglError] = useState(false);

  const stateRef = useRef({
    soilVisible: true,
    rootsVisible: true,
    playing: true,
    growthTarget: 0.72,
    growthCurrent: 0.72,
    resetCameraRequested: false,
  });

  useEffect(() => {
    stateRef.current.soilVisible = soilVisible;
  }, [soilVisible]);

  useEffect(() => {
    stateRef.current.rootsVisible = rootsVisible;
  }, [rootsVisible]);

  useEffect(() => {
    stateRef.current.playing = playing;
  }, [playing]);

  useEffect(() => {
    stateRef.current.growthTarget = growthProgress / 100;
  }, [growthProgress]);

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
    scene.background = new THREE.Color(0x102119);
    scene.fog = new THREE.FogExp2(0x102119, 0.042);

    const camera = new THREE.PerspectiveCamera(
      42,
      Math.max(container.clientWidth, 300) / Math.max(container.clientHeight, 260),
      0.1,
      60,
    );
    const defaultCamPos = new THREE.Vector3(4.35, 1.35, 6.4);
    const defaultTarget = new THREE.Vector3(0, -0.15, 0);
    camera.position.copy(defaultCamPos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(defaultTarget);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 2.6;
    controls.maxDistance = 10.5;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.update();

    const { envTex } = applyStudioEnvironmentAndLights(scene, renderer, isSoftwareGl, 5);
    const { map: soilMap, bumpMap: soilBump } = createSoilStrataTextures(renderer);
    const shadowTex = createContactShadowTexture();

    // Grounded contact shadow disc beneath soil cutaway
    const contactShadow = new THREE.Mesh(
      new THREE.CircleGeometry(2.7, 40),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.75,
      }),
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = -2.26;
    scene.add(contactShadow);

    // ===== 1. SOIL CROSS-SECTION CUTAWAY GROUP =====
    const soilGroup = new THREE.Group();
    scene.add(soilGroup);

    const soilOuterMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: soilMap,
      bumpMap: soilBump,
      bumpScale: 0.05,
      roughness: 0.92,
      metalness: 0.02,
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide,
    });

    // Cutaway cylinder (260° arc) so the front root profile is richly visible while soil surrounds the roots
    const soilGeo = new THREE.CylinderGeometry(1.72, 1.56, 2.2, 36, 1, false, Math.PI * 0.22, Math.PI * 1.56);
    const soilBlock = new THREE.Mesh(soilGeo, soilOuterMat);
    soilBlock.position.y = -1.12;
    soilBlock.receiveShadow = !isSoftwareGl;
    soilGroup.add(soilBlock);

    // Topsoil organic rim cap with grass/moss crust
    const topSoilMat = new THREE.MeshStandardMaterial({
      color: 0x3b4a2b,
      bumpMap: soilBump,
      bumpScale: 0.04,
      roughness: 0.9,
      metalness: 0.02,
    });
    const topCap = new THREE.Mesh(
      new THREE.CylinderGeometry(1.75, 1.72, 0.1, 36, 1, false, Math.PI * 0.22, Math.PI * 1.56),
      topSoilMat,
    );
    topCap.position.y = -0.02;
    topCap.receiveShadow = !isSoftwareGl;
    soilGroup.add(topCap);

    // Subtle transparent glass rhizotron cutaway frame along front opening
    const frameGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0xdff5ea,
      roughness: 0.12,
      metalness: 0.05,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });
    const glassArc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.74, 1.58, 2.22, 24, 1, true, -Math.PI * 0.22, Math.PI * 0.44),
      frameGlassMat,
    );
    glassArc.position.y = -1.12;
    glassArc.renderOrder = 5;
    soilGroup.add(glassArc);

    // Depth scale markers (10cm & 25cm subtle glowing lines)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x76d69d,
      transparent: true,
      opacity: 0.35,
    });
    const depth10Ring = new THREE.Mesh(new THREE.TorusGeometry(1.73, 0.012, 8, 48), ringMat);
    depth10Ring.rotation.x = Math.PI / 2;
    depth10Ring.position.y = -0.72;
    soilGroup.add(depth10Ring);

    const depth25Ring = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.012, 8, 48), ringMat);
    depth25Ring.rotation.x = Math.PI / 2;
    depth25Ring.position.y = -1.62;
    soilGroup.add(depth25Ring);

    // Instanced damp soil pebbles & moisture droplets inside cutaway
    const pebbleGeo = new THREE.DodecahedronGeometry(0.035, 0);
    const pebbleMat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05 });
    const pebbleCount = 56;
    const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, pebbleCount);
    const dummy = new THREE.Object3D();
    const tmpColor = new THREE.Color();
    for (let i = 0; i < pebbleCount; i++) {
      const angle = (i / pebbleCount) * Math.PI * 1.45 + Math.PI * 0.28;
      const radius = 0.55 + ((i * 37) % 100) / 100 * 1.02;
      const y = -0.22 - ((i * 53) % 100) / 100 * 1.85;
      dummy.position.set(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
      const s = 0.7 + ((i * 19) % 10) * 0.09;
      dummy.scale.set(s, s * 0.75, s);
      dummy.rotation.set(i * 0.5, i * 0.8, 0);
      dummy.updateMatrix();
      pebbles.setMatrixAt(i, dummy.matrix);
      tmpColor.setHex(i % 4 === 0 ? 0x5c9c82 : 0x6b4e38);
      pebbles.setColorAt(i, tmpColor);
    }
    pebbles.instanceMatrix.needsUpdate = true;
    if (pebbles.instanceColor) pebbles.instanceColor.needsUpdate = true;
    pebbles.computeBoundingSphere();
    soilGroup.add(pebbles);

    // ===== 2. COMPOSITE 3D PLANT ABOVE SOIL =====
    const plantGroup = new THREE.Group();
    scene.add(plantGroup);

    const stemMat = new THREE.MeshStandardMaterial({
      color: 0x3b7a47,
      roughness: 0.62,
      metalness: 0.04,
    });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x439c58,
      roughness: 0.44,
      metalness: 0.06,
      side: THREE.DoubleSide,
    });
    const leafLightMat = new THREE.MeshStandardMaterial({
      color: 0x62ba6e,
      roughness: 0.38,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    // Main curved stem
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.05, 0),
      new THREE.Vector3(0.03, 0.45, 0.02),
      new THREE.Vector3(-0.02, 1.05, -0.01),
      new THREE.Vector3(0.02, 1.62, 0.02),
    ]);
    const mainStem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 20, 0.068, 10, false), stemMat);
    mainStem.castShadow = !isSoftwareGl;
    plantGroup.add(mainStem);

    // Root collar flare at soil surface
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.16, 12), stemMat);
    collar.position.y = 0.02;
    plantGroup.add(collar);

    // Procedural sculpted botanical leaf shape
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.bezierCurveTo(0.24, 0.16, 0.32, 0.56, 0, 0.92);
    leafShape.bezierCurveTo(-0.32, 0.56, -0.24, 0.16, 0, 0);
    const leafGeo = new THREE.ExtrudeGeometry(leafShape, {
      depth: 0.015,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 2,
    });
    // Slight natural arch along leaf length
    const posAttr = leafGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const ly = posAttr.getY(i);
      posAttr.setZ(i, posAttr.getZ(i) - ly * ly * 0.28);
    }
    leafGeo.computeVertexNormals();

    const leafSpecs = [
      { y: 0.48, rotY: 0.2, tilt: 0.92, scale: 0.85, mat: leafMat },
      { y: 0.62, rotY: 2.3, tilt: 0.88, scale: 0.92, mat: leafMat },
      { y: 0.82, rotY: 4.35, tilt: 0.84, scale: 0.96, mat: leafLightMat },
      { y: 1.08, rotY: 1.15, tilt: 0.78, scale: 0.88, mat: leafMat },
      { y: 1.28, rotY: 3.35, tilt: 0.72, scale: 0.78, mat: leafLightMat },
      { y: 1.48, rotY: 5.4, tilt: 0.56, scale: 0.64, mat: leafLightMat },
      { y: 1.6, rotY: 0.7, tilt: 0.38, scale: 0.52, mat: leafLightMat },
    ];

    leafSpecs.forEach((spec) => {
      const holder = new THREE.Group();
      holder.position.set(0, spec.y, 0);
      holder.rotation.y = spec.rotY;

      // Petiole branch
      const petiole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.24, 8), stemMat);
      petiole.position.set(0, 0.08, 0.09);
      petiole.rotation.x = 0.78;
      holder.add(petiole);

      const leafMesh = new THREE.Mesh(leafGeo, spec.mat);
      leafMesh.position.set(0, 0.16, 0.18);
      leafMesh.rotation.x = spec.tilt;
      leafMesh.scale.setScalar(spec.scale);
      leafMesh.castShadow = !isSoftwareGl;
      holder.add(leafMesh);

      plantGroup.add(holder);
    });

    // ===== 3. PROCEDURAL MULTI-GENERATION 3D ROOT SYSTEM =====
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const rootPrimaryMat = new THREE.MeshStandardMaterial({
      color: 0xe6d9bc,
      roughness: 0.68,
      metalness: 0.02,
    });
    const rootLateralMat = new THREE.MeshStandardMaterial({
      color: 0xf1e7ce,
      roughness: 0.62,
      metalness: 0.02,
    });
    const rootFineMat = new THREE.MeshStandardMaterial({
      color: 0xd8c79f,
      roughness: 0.74,
      metalness: 0.01,
    });

    const rootSegments: RootSegmentMeta[] = [];

    function addRootBranch(
      points: THREE.Vector3[],
      radius: number,
      mat: THREE.Material,
      startAt: number,
      endAt: number,
      radialSegs = 8,
    ) {
      const curve = new THREE.CatmullRomCurve3(points);
      const tubularSegs = 22;
      const geo = new THREE.TubeGeometry(curve, tubularSegs, radius, radialSegs, false);

      // Taper radius smoothly toward root tip
      const pos = geo.attributes.position;
      const ringSize = radialSegs + 1;
      for (let i = 0; i <= tubularSegs; i++) {
        const t = i / tubularSegs;
        const center = curve.getPointAt(t);
        const taper = 1 - t * 0.72;
        for (let j = 0; j < ringSize; j++) {
          const idx = i * ringSize + j;
          pos.setXYZ(
            idx,
            center.x + (pos.getX(idx) - center.x) * taper,
            center.y + (pos.getY(idx) - center.y) * taper,
            center.z + (pos.getZ(idx) - center.z) * taper,
          );
        }
      }
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, mat);
      const fullIndices = geo.index ? geo.index.count : pos.count;
      rootGroup.add(mesh);
      rootSegments.push({ mesh, startAt, endAt, fullIndices });
    }

    // Primary Taproot
    addRootBranch(
      [
        new THREE.Vector3(0, 0.0, 0),
        new THREE.Vector3(0.05, -0.52, 0.06),
        new THREE.Vector3(-0.04, -1.14, 0.02),
        new THREE.Vector3(0.06, -1.68, -0.05),
        new THREE.Vector3(-0.02, -2.08, 0.04),
      ],
      0.062,
      rootPrimaryMat,
      0.0,
      0.55,
      10,
    );

    // Secondary Lateral Roots (10 radiating branches at varying depths)
    const lateralAngles = [0.15, 0.85, 1.55, 2.2, 2.95, 3.65, 4.35, 5.1, 5.75, 0.5];
    lateralAngles.forEach((ang, idx) => {
      const startY = -0.18 - idx * 0.15;
      const spread = 0.72 + (idx % 3) * 0.26;
      const drop = 0.55 + (idx % 4) * 0.18;
      const p0 = new THREE.Vector3(0, startY, 0);
      const p1 = new THREE.Vector3(
        Math.cos(ang) * spread * 0.42,
        startY - drop * 0.34,
        Math.sin(ang) * spread * 0.42,
      );
      const p2 = new THREE.Vector3(
        Math.cos(ang + 0.16) * spread * 0.78,
        startY - drop * 0.72,
        Math.sin(ang + 0.16) * spread * 0.78,
      );
      const p3 = new THREE.Vector3(
        Math.cos(ang - 0.1) * spread,
        Math.max(-2.12, startY - drop),
        Math.sin(ang - 0.1) * spread,
      );

      const startAt = 0.16 + idx * 0.045;
      const endAt = Math.min(0.95, startAt + 0.42);
      addRootBranch([p0, p1, p2, p3], 0.028 - (idx % 3) * 0.004, rootLateralMat, startAt, endAt, 7);

      // Tertiary fine rootlets branching off each lateral root
      const subAngA = ang + 0.48;
      addRootBranch(
        [
          p1.clone(),
          p1
            .clone()
            .add(new THREE.Vector3(Math.cos(subAngA) * 0.24, -0.22, Math.sin(subAngA) * 0.24)),
          p1
            .clone()
            .add(new THREE.Vector3(Math.cos(subAngA) * 0.44, -0.46, Math.sin(subAngA) * 0.44)),
        ],
        0.013,
        rootFineMat,
        Math.min(0.82, startAt + 0.2),
        1.0,
        5,
      );

      const subAngB = ang - 0.52;
      addRootBranch(
        [
          p2.clone(),
          p2
            .clone()
            .add(new THREE.Vector3(Math.cos(subAngB) * 0.2, -0.18, Math.sin(subAngB) * 0.2)),
          p2
            .clone()
            .add(new THREE.Vector3(Math.cos(subAngB) * 0.36, -0.38, Math.sin(subAngB) * 0.36)),
        ],
        0.011,
        rootFineMat,
        Math.min(0.86, startAt + 0.28),
        1.0,
        5,
      );
    });

    // Apply growth progress directly to TubeGeometry drawRange & canopy scale
    const applyGrowth = (progress: number) => {
      const p = THREE.MathUtils.clamp(progress, 0.08, 1);
      for (const seg of rootSegments) {
        const local = THREE.MathUtils.clamp((p - seg.startAt) / (seg.endAt - seg.startAt), 0, 1);
        const count = Math.floor((local * seg.fullIndices) / 3) * 3;
        seg.mesh.geometry.setDrawRange(0, count);
        seg.mesh.visible = count > 0;
      }
      const canopyScale = 0.65 + p * 0.35;
      plantGroup.scale.setScalar(canopyScale);
    };
    applyGrowth(stateRef.current.growthCurrent);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const afterDraw = createAfterDraw(renderer);
    let rafId = 0;
    let lastTime = performance.now();
    let lastUiSync = 0;
    const _camGoal = new THREE.Vector3();
    const _targetGoal = new THREE.Vector3();

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
      const h = Math.max(container.clientHeight, 260);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const s = stateRef.current;

      // Smooth growth progression when playing
      if (s.playing) {
        s.growthTarget += dt * 0.11;
        if (s.growthTarget > 1.02) {
          s.growthTarget = 0.15;
        }
        if (now - lastUiSync > 220) {
          lastUiSync = now;
          setGrowthProgress(Math.round(THREE.MathUtils.clamp(s.growthTarget, 0.1, 1) * 100));
        }
      }

      s.growthCurrent = THREE.MathUtils.damp(s.growthCurrent, s.growthTarget, 7, dt);
      applyGrowth(s.growthCurrent);

      // Gentle botanical breeze sway above soil
      plantGroup.rotation.z = Math.sin(now * 0.0012) * 0.025;
      plantGroup.rotation.x = Math.cos(now * 0.0009) * 0.015;

      // Visibility toggles
      soilGroup.visible = s.soilVisible;
      rootGroup.visible = s.rootsVisible;

      // Smooth camera reset
      if (s.resetCameraRequested) {
        _camGoal.copy(defaultCamPos);
        _targetGoal.copy(defaultTarget);
        camera.position.lerp(_camGoal, 1 - Math.exp(-6 * dt));
        controls.target.lerp(_targetGoal, 1 - Math.exp(-6 * dt));
        if (camera.position.distanceTo(_camGoal) < 0.03) {
          camera.position.copy(_camGoal);
          controls.target.copy(_targetGoal);
          s.resetCameraRequested = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

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
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      envTex.dispose();
      soilMap.dispose();
      soilBump.dispose();
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
      <div className="flex h-[420px] items-center justify-center rounded-xl border border-[#1E3A2B] bg-[#102119] p-6 text-center text-sm text-[#CBE3D5]">
        WebGL 3D preview unavailable in this browser environment.
      </div>
    );
  }

  return (
    <div
      data-testid="root-growth-3d"
      data-growth-progress={growthProgress}
      className={`relative w-full overflow-hidden rounded-xl border border-[#234232] bg-[#102119] ${
        compact ? 'h-[440px] lg:h-[520px]' : 'h-[540px]'
      }`}
    >
      {/* Dedicated isolated WebGL canvas mount */}
      <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

      {/* Minimal top-left depth legend (no backdrop-blur over WebGL) */}
      <div className="pointer-events-none absolute top-3.5 left-3.5 z-10 rounded-lg border border-white/10 bg-[#0D1C15]/90 px-3 py-1.5 text-xs text-[#D3E7DC]">
        <span className="font-medium text-white">{t('three_growth_stage')}:</span>{' '}
        <span className="font-mono tabular-nums text-[#7BE0A2]">{growthProgress}%</span>
        <span className="mx-2 text-white/30">·</span>
        <span className="text-[#A8C8B6]">10cm / 25cm</span>
      </div>

      {/* Unified Collapsible Bottom Control Dock (solid/rgba fill, zero viewport center occlusion) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex flex-col items-center px-3">
        <button
          type="button"
          onClick={() => setDockOpen((v) => !v)}
          aria-expanded={dockOpen}
          className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-[#0D1C15]/95 px-2.5 py-1 text-xs font-medium text-[#D5E9DE] transition-colors hover:bg-[#162D22] whitespace-nowrap shrink-0"
        >
          {dockOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          <span>{dockOpen ? t('three_hide_controls') : t('three_show_controls')}</span>
        </button>

        {dockOpen && (
          <div className="pointer-events-auto flex max-w-[96%] items-center gap-1.5 overflow-x-auto rounded-xl border border-white/15 bg-[#0D1C15]/95 px-2.5 py-1.5 text-[11px] text-white shadow-lg">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2E7D4F] px-2.5 py-1.5 font-medium text-white transition-colors hover:bg-[#256640] whitespace-nowrap shrink-0"
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{playing ? t('three_pause_growth') : t('three_play_growth')}</span>
            </button>

            <label className="flex items-center px-1 text-[#C5DDD0] shrink-0">
              <span className="sr-only">{t('three_growth_stage')}</span>
              <input
                type="range"
                min={10}
                max={100}
                value={growthProgress}
                onChange={(e) => {
                  setPlaying(false);
                  setGrowthProgress(Number(e.target.value));
                }}
                aria-label={t('three_growth_stage')}
                className="h-1.5 w-20 accent-[#59C17D]"
              />
            </label>

            <button
              type="button"
              onClick={() => setSoilVisible((v) => !v)}
              aria-pressed={soilVisible}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 font-medium transition-colors whitespace-nowrap shrink-0 ${
                soilVisible
                  ? 'border-[#4D9E6C] bg-[#1B3A2A] text-[#DCF5E5]'
                  : 'border-white/15 bg-transparent text-[#9FB8AA] hover:text-white'
              }`}
            >
              {soilVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              <span>{t('three_toggle_soil')}</span>
            </button>

            <button
              type="button"
              onClick={() => setRootsVisible((v) => !v)}
              aria-pressed={rootsVisible}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 font-medium transition-colors whitespace-nowrap shrink-0 ${
                rootsVisible
                  ? 'border-[#4D9E6C] bg-[#1B3A2A] text-[#DCF5E5]'
                  : 'border-white/15 bg-transparent text-[#9FB8AA] hover:text-white'
              }`}
            >
              {rootsVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              <span>{t('three_toggle_roots')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stateRef.current.resetCameraRequested = true;
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1.5 font-medium text-[#D5E9DE] transition-colors hover:bg-white/10 whitespace-nowrap shrink-0"
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
