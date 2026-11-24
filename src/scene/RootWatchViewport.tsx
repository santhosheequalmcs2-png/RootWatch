import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {
  COMPONENT_ORDER,
  COMPONENT_SPECS,
  DEFAULT_CAMERA_POSE,
  type CameraPose,
  type ComponentId,
} from '../data/componentsData';
import { buildRootWatchDevice, type RootWatchDeviceRig } from './deviceBuilder';
import { createDeviceMaterials } from './materials';
import { createProceduralTextures } from './textures';

export interface ProjectedLabel {
  id: ComponentId;
  label: string;
  anchorX: number;
  anchorY: number;
  boxX: number;
  boxY: number;
  visible: boolean;
  experimental?: boolean;
}

export interface RootWatchViewportProps {
  selectedId: ComponentId | null;
  highlightedIds: ComponentId[];
  exploded: boolean;
  lidOpenFactor: number;
  ledBoost: number;
  showLabels: boolean;
  cameraRequest: { pose: CameraPose; seq: number } | null;
  inspectorOpen: boolean;
  onSelectComponent: (id: ComponentId | null) => void;
  onHoverComponent?: (id: ComponentId | null) => void;
  onLabelsUpdate: (labels: ProjectedLabel[]) => void;
}

// Module-scope reusable scratch math objects (zero GC inside animation loop)
const _vec3 = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();
const _mouse = new THREE.Vector2();

function detectSoftwareGl(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

/**
 * Resolves 2D screen-space label overlap via deterministic relaxation passes,
 * keeping labels inside safe viewport bounds away from top bar, bottom dock, and side panel.
 */
function layoutNonOverlappingLabels(
  raw: ProjectedLabel[],
  width: number,
  height: number,
  inspectorOpen: boolean,
): ProjectedLabel[] {
  const rightSafeMargin = inspectorOpen && width >= 1024 ? 352 : 24;
  const leftSafeMargin = 20;
  const topSafeMargin = 72;
  const bottomSafeMargin = 112;
  const labelW = 148;
  const labelH = 28;
  const padX = 10;
  const padY = 8;

  const placed = raw.map((item) => {
    // Bias initial offset outward from center of device so leader lines radiate cleanly
    const centerX = (width - (inspectorOpen && width >= 1024 ? 320 : 0)) * 0.5;
    const sideSign = item.anchorX >= centerX ? 1 : -1;
    const boxX = THREE.MathUtils.clamp(
      item.anchorX + sideSign * 42,
      leftSafeMargin + labelW * 0.5,
      Math.max(leftSafeMargin + labelW * 0.5, width - rightSafeMargin - labelW * 0.5),
    );
    const boxY = THREE.MathUtils.clamp(
      item.anchorY - 14,
      topSafeMargin + labelH * 0.5,
      Math.max(topSafeMargin + labelH * 0.5, height - bottomSafeMargin - labelH * 0.5),
    );
    return { ...item, boxX, boxY };
  });

  // Iterative pairwise repulsion (12 passes)
  for (let pass = 0; pass < 12; pass++) {
    for (let i = 0; i < placed.length; i++) {
      if (!placed[i].visible) continue;
      for (let j = i + 1; j < placed.length; j++) {
        if (!placed[j].visible) continue;
        const a = placed[i];
        const b = placed[j];
        const dx = b.boxX - a.boxX;
        const dy = b.boxY - a.boxY;
        const minW = labelW + padX;
        const minH = labelH + padY;

        if (Math.abs(dx) < minW && Math.abs(dy) < minH) {
          const overlapY = minH - Math.abs(dy);
          const pushY = (overlapY * 0.55 + 1.5) * (dy >= 0 ? 1 : -1);
          a.boxY -= pushY;
          b.boxY += pushY;

          // Subtle horizontal nudge if stacked vertically at identical X
          if (Math.abs(dx) < minW * 0.5) {
            const pushX = (dx >= 0 ? 1 : -1) * 4;
            a.boxX -= pushX;
            b.boxX += pushX;
          }
        }
      }
    }

    // Clamp to viewport bounds each pass
    for (let i = 0; i < placed.length; i++) {
      placed[i].boxX = THREE.MathUtils.clamp(
        placed[i].boxX,
        leftSafeMargin + labelW * 0.5,
        Math.max(leftSafeMargin + labelW * 0.5, width - rightSafeMargin - labelW * 0.5),
      );
      placed[i].boxY = THREE.MathUtils.clamp(
        placed[i].boxY,
        topSafeMargin + labelH * 0.5,
        Math.max(topSafeMargin + labelH * 0.5, height - bottomSafeMargin - labelH * 0.5),
      );
    }
  }

  return placed;
}

export function RootWatchViewport({
  selectedId,
  highlightedIds,
  exploded,
  lidOpenFactor,
  ledBoost,
  showLabels,
  cameraRequest,
  inspectorOpen,
  onSelectComponent,
  onHoverComponent,
  onLabelsUpdate,
}: RootWatchViewportProps) {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  // Mutable ref state read by the stable WebGL loop without remounting canvas
  const stateRef = useRef({
    selectedId,
    highlightedIds,
    exploded,
    lidOpenFactor,
    ledBoost,
    showLabels,
    inspectorOpen,
    hoveredId: null as ComponentId | null,
    onSelectComponent,
    onHoverComponent,
    onLabelsUpdate,
  });

  stateRef.current.selectedId = selectedId;
  stateRef.current.highlightedIds = highlightedIds;
  stateRef.current.exploded = exploded;
  stateRef.current.lidOpenFactor = lidOpenFactor;
  stateRef.current.ledBoost = ledBoost;
  stateRef.current.showLabels = showLabels;
  stateRef.current.inspectorOpen = inspectorOpen;
  stateRef.current.onSelectComponent = onSelectComponent;
  stateRef.current.onHoverComponent = onHoverComponent;
  stateRef.current.onLabelsUpdate = onLabelsUpdate;

  // Exposed trigger handle so prop changes wake the on-demand render loop cleanly
  const engineRef = useRef<{
    requestRender: () => void;
    setCameraGoal: (pose: CameraPose) => void;
    applyHighlights: () => void;
  } | null>(null);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const isSoftwareGl = detectSoftwareGl();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('WebGL2 rendering is unavailable in this browser session.');
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initialW = mount.clientWidth || window.innerWidth;
    const initialH = mount.clientHeight || window.innerHeight;
    renderer.setSize(initialW, initialH);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    mount.appendChild(renderer.domElement);

    // Scene & horizon-matched atmospheric fog
    const scene = new THREE.Scene();
    const bgHex = 0x0a110e;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.042);

    // Mandatory studio reflection environment on every device
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // Perspective camera framed so the RootWatch prototype commands the viewport
    const camera = new THREE.PerspectiveCamera(40, initialW / initialH, 0.1, 80);
    camera.position.set(...DEFAULT_CAMERA_POSE.position);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...DEFAULT_CAMERA_POSE.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.065;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.minDistance = 2.0;
    controls.maxDistance = 14.5;
    controls.maxPolarAngle = Math.PI * 0.485;
    controls.update();

    // 3-Point Warm/Cool Studio Lighting Rig (same intensities across GPU and software WebGL)
    const hemiLight = new THREE.HemisphereLight(0xcbe6dc, 0x16221b, 0.72);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.2);
    keyLight.position.set(5.5, 8.2, 6.4);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 24;
    keyLight.shadow.camera.left = -5.5;
    keyLight.shadow.camera.right = 5.5;
    keyLight.shadow.camera.top = 5.5;
    keyLight.shadow.camera.bottom = -5.5;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x7fc9a4, 0.85);
    rimLight.position.set(-5.2, 4.4, -5.8);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0x9bc4d8, 0.55);
    fillLight.position.set(-4.5, 2.2, 4.8);
    scene.add(fillLight);

    // Optional studio softbox panel on hardware GPU
    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softbox = new THREE.RectAreaLight(0xeef9f2, 2.4, 4.5, 2.5);
      softbox.position.set(0.5, 4.5, 4.2);
      softbox.lookAt(0, 1.5, 0);
      scene.add(softbox);
    }

    // Procedural Textures & PBR Materials
    const textures = createProceduralTextures(renderer.capabilities.getMaxAnisotropy());
    const materials = createDeviceMaterials(textures, isSoftwareGl);

    // Grounded Lab Plinth Floor + Radial Contact Shadow (offset vertically so zero Z-fighting)
    const floorGeo = new THREE.PlaneGeometry(42, 42);
    const floorMat = new THREE.MeshStandardMaterial({
      map: textures.floorGrid,
      roughness: 0.86,
      metalness: 0.14,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.025;
    floor.receiveShadow = true;
    scene.add(floor);

    const shadowPlaneGeo = new THREE.PlaneGeometry(7.2, 4.4);
    const shadowPlaneMat = new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(-0.38, -0.002, 0.25);
    scene.add(shadowPlane);

    // Build the full RootWatch 3D Prototype Assembly
    const rig: RootWatchDeviceRig = buildRootWatchDevice(materials);
    scene.add(rig.root);

    // Pre-warm shaders on hardware GPU
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Animation state variables
    let currentExplode = 0;
    let currentLidOpen = 0;
    let currentLedBoost = stateRef.current.ledBoost;
    let cameraGoalActive = false;
    let lastTime = performance.now();
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let disposed = false;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const projectLabels = () => {
      if (!stateRef.current.showLabels) return;
      const width = renderer.domElement.clientWidth || window.innerWidth;
      const height = renderer.domElement.clientHeight || window.innerHeight;
      const raw: ProjectedLabel[] = [];

      COMPONENT_ORDER.forEach((id) => {
        const spec = COMPONENT_SPECS[id];
        const isSelectedOrHighlighted =
          stateRef.current.selectedId === id || stateRef.current.highlightedIds.includes(id);
        if (!spec.showDefaultLabel && !isSelectedOrHighlighted) return;

        const anchor = rig.anchors[id];
        if (!anchor) return;
        anchor.getWorldPosition(_vec3);
        _vec3.project(camera);

        const isBehind = _vec3.z > 1 || _vec3.z < -1;
        const anchorX = ((_vec3.x + 1) * 0.5) * width;
        const anchorY = ((-_vec3.y + 1) * 0.5) * height;

        raw.push({
          id,
          label: spec.shortLabel,
          anchorX,
          anchorY,
          boxX: anchorX,
          boxY: anchorY,
          visible: !isBehind,
          experimental: spec.experimental,
        });
      });

      const resolved = layoutNonOverlappingLabels(
        raw,
        width,
        height,
        stateRef.current.inspectorOpen,
      );
      stateRef.current.onLabelsUpdate(resolved);
    };

    const applyHighlights = () => {
      rig.setHighlightState(
        stateRef.current.selectedId,
        stateRef.current.highlightedIds,
        stateRef.current.hoveredId,
      );
    };

    const requestRender = () => {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;

        const now = performance.now();
        const dt = Math.min(0.08, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;

        let needsMoreFrames = false;

        // 1. Smoothly damp exploded view factor
        const targetExplode = stateRef.current.exploded ? 1 : 0;
        if (Math.abs(currentExplode - targetExplode) > 0.001) {
          currentExplode = THREE.MathUtils.damp(currentExplode, targetExplode, 5.2, dt);
          needsMoreFrames = true;
        } else {
          currentExplode = targetExplode;
        }

        // 2. Smoothly damp enclosure lid open factor (opens in exploded view OR when ESP32 is inspected)
        const targetLid =
          stateRef.current.exploded ||
          stateRef.current.lidOpenFactor > 0.5 ||
          stateRef.current.selectedId === 'esp32'
            ? 1
            : 0;
        if (Math.abs(currentLidOpen - targetLid) > 0.001) {
          currentLidOpen = THREE.MathUtils.damp(currentLidOpen, targetLid, 5.8, dt);
          needsMoreFrames = true;
        } else {
          currentLidOpen = targetLid;
        }

        // 3. Smoothly damp LED illumination intensity boost
        const targetLed =
          stateRef.current.selectedId === 'leds' || stateRef.current.selectedId === 'camera'
            ? 1.0
            : stateRef.current.ledBoost;
        if (Math.abs(currentLedBoost - targetLed) > 0.002) {
          currentLedBoost = THREE.MathUtils.damp(currentLedBoost, targetLed, 5.5, dt);
          needsMoreFrames = true;
        } else {
          currentLedBoost = targetLed;
        }
        rig.setLedBoost(currentLedBoost);

        // Apply exploded positions across all device parts
        for (let i = 0; i < rig.animatedParts.length; i++) {
          const part = rig.animatedParts[i];
          part.object.position
            .copy(part.assembledPosition)
            .addScaledVector(part.explodedOffset, currentExplode);
          if (part.assembledRotation && part.explodedRotationOffset) {
            part.object.rotation.set(
              part.assembledRotation.x + part.explodedRotationOffset.x * currentExplode,
              part.assembledRotation.y + part.explodedRotationOffset.y * currentExplode,
              part.assembledRotation.z + part.explodedRotationOffset.z * currentExplode,
            );
          }
        }

        // Apply dedicated lid reveal transform
        rig.lidPart.object.position
          .copy(rig.lidPart.assembledPosition)
          .addScaledVector(rig.lidPart.explodedOffset, currentLidOpen);
        if (rig.lidPart.assembledRotation && rig.lidPart.explodedRotationOffset) {
          rig.lidPart.object.rotation.set(
            rig.lidPart.assembledRotation.x + rig.lidPart.explodedRotationOffset.x * currentLidOpen,
            rig.lidPart.assembledRotation.y + rig.lidPart.explodedRotationOffset.y * currentLidOpen,
            rig.lidPart.assembledRotation.z + rig.lidPart.explodedRotationOffset.z * currentLidOpen,
          );
        }

        // 4. Smooth scripted camera transitions (canceled immediately if user grabs OrbitControls)
        if (cameraGoalActive) {
          const k = 1 - Math.exp(-5.0 * dt);
          camera.position.lerp(_targetPos, k);
          controls.target.lerp(_targetLook, k);

          if (
            camera.position.distanceToSquared(_targetPos) < 0.0004 &&
            controls.target.distanceToSquared(_targetLook) < 0.0004
          ) {
            camera.position.copy(_targetPos);
            controls.target.copy(_targetLook);
            cameraGoalActive = false;
          } else {
            needsMoreFrames = true;
          }
        }

        const controlsChanged = controls.update();
        if (controlsChanged && controls.enableDamping) {
          needsMoreFrames = true;
        }

        scene.updateMatrixWorld();
        renderer.render(scene, camera);

        if (stateRef.current.showLabels) {
          projectLabels();
        }

        const done = () => {
          renderBusy = false;
          if (renderDirty || needsMoreFrames) {
            requestRender();
          }
        };

        if (isSoftwareGl) {
          afterDraw(done);
        } else {
          done();
        }
      });
    };

    const setCameraGoal = (pose: CameraPose) => {
      _targetPos.set(...pose.position);
      _targetLook.set(...pose.target);
      cameraGoalActive = true;
      lastTime = performance.now();
      requestRender();
    };

    engineRef.current = {
      requestRender,
      setCameraGoal,
      applyHighlights,
    };

    // Cancel scripted camera motion whenever the user manually orbits/zooms/pans
    const onControlStart = () => {
      cameraGoalActive = false;
    };
    const onControlChange = () => {
      requestRender();
    };
    controls.addEventListener('start', onControlStart);
    controls.addEventListener('change', onControlChange);

    // =========================================================================
    // RAYCASTING INTERACTION (Click selection + throttled hover)
    // =========================================================================
    const raycaster = new THREE.Raycaster();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverTime = 0;

    const pickComponent = (clientX: number, clientY: number): ComponentId | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      _mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(_mouse, camera);
      const hits = raycaster.intersectObjects(rig.clickableMeshes, false);
      if (hits.length === 0) return null;

      // Smart glass pass-through: if the closest hit is a transparent acrylic pane of the
      // root chamber, check if a solid interior root or sensor lies directly behind the click.
      const firstHit = hits[0];
      const firstId = firstHit.object.userData.componentId as ComponentId | undefined;
      const firstMat = (firstHit.object as THREE.Mesh).material;
      const isTransparentGlass =
        !Array.isArray(firstMat) &&
        firstMat &&
        'transparent' in firstMat &&
        Boolean((firstMat as THREE.Material).transparent);

      if (firstId === 'root-chamber' && isTransparentGlass) {
        for (let i = 1; i < hits.length; i++) {
          const candidateId = hits[i].object.userData.componentId as ComponentId | undefined;
          if (candidateId && candidateId !== 'root-chamber') {
            return candidateId;
          }
        }
      }

      return firstId ?? null;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      // Only treat as a selection click if pointer didn't drag to orbit
      if (dist > 6) return;
      const picked = pickComponent(e.clientX, e.clientY);
      stateRef.current.onSelectComponent(picked);
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverTime < 45) return;
      lastHoverTime = now;

      const hovered = pickComponent(e.clientX, e.clientY);
      if (hovered !== stateRef.current.hoveredId) {
        stateRef.current.hoveredId = hovered;
        renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
        if (hovered) {
          stateRef.current.onHoverComponent?.(hovered);
        }
        applyHighlights();
        requestRender();
      }
    };

    const onPointerLeave = () => {
      if (stateRef.current.hoveredId !== null) {
        stateRef.current.hoveredId = null;
        renderer.domElement.style.cursor = 'grab';
        applyHighlights();
        requestRender();
      }
    };

    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);

    // WebGL Context Loss Recovery
    const onContextLost = (event: Event) => {
      event.preventDefault();
      setWebglError('WebGL rendering context was interrupted. Attempting recovery...');
    };
    const onContextRestored = () => {
      setWebglError(null);
      requestRender();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    // Responsive ResizeObserver
    const handleResize = () => {
      if (!mount || disposed) return;
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);
    window.addEventListener('resize', handleResize);

    // Initial render
    applyHighlights();
    requestRender();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      engineRef.current = null;

      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('change', onControlChange);
      controls.dispose();

      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      rig.dispose();
      materials.dispose();
      textures.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      shadowPlaneGeo.dispose();
      shadowPlaneMat.dispose();
      envTarget.dispose();
      renderer.dispose();

      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // React prop synchronization into stable WebGL scene without remounting
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.applyHighlights();
    engineRef.current.requestRender();
  }, [selectedId, highlightedIds, exploded, lidOpenFactor, ledBoost, showLabels, inspectorOpen]);

  useEffect(() => {
    if (!cameraRequest || !engineRef.current) return;
    engineRef.current.setCameraGoal(cameraRequest.pose);
  }, [cameraRequest]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0a110e]">
      <div
        ref={canvasMountRef}
        className="h-full w-full"
        aria-label="Interactive 3D RootWatch Device Viewport"
      />
      {webglError && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0a110e] p-6">
          <div className="max-w-md rounded-xl border border-[#2d4a3a] bg-[#101c16] p-6 text-center">
            <h2 className="font-display text-lg font-semibold text-[#f3f1ea]">
              3D Viewport Unavailable
            </h2>
            <p className="mt-2 text-sm text-[#a6bbb0]">{webglError}</p>
          </div>
        </div>
      )}
    </div>
  );
}
