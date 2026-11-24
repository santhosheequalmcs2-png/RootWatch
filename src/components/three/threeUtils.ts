import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

let cachedSoftwareGl: boolean | null = null;

/**
 * Detects software WebGL renderers (SwiftShader, llvmpipe, WARP) from the WebGL renderer string.
 * Used strictly for rendering cost budgets (pixel ratio, AA, shadows, frame pacing).
 */
export function detectSoftwareGl(): boolean {
  if (cachedSoftwareGl !== null) return cachedSoftwareGl;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      cachedSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return cachedSoftwareGl;
  } catch {
    cachedSoftwareGl = true;
    return true;
  }
}

export function createStudioRenderer(container: HTMLElement, isSoftwareGl: boolean) {
  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(Math.max(container.clientWidth, 300), Math.max(container.clientHeight, 260));
  container.appendChild(renderer.domElement);
  return renderer;
}

export function applyStudioEnvironmentAndLights(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
  shadowExtent = 6,
) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmrem.dispose();

  // Warm key directional light + cool hemisphere fill + subtle rim light
  const hemi = new THREE.HemisphereLight(0xdcebe3, 0x3b2a1e, 0.85);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xfff5e4, 1.85);
  keyLight.position.set(5.5, 8.5, 6.0);
  keyLight.castShadow = !isSoftwareGl;
  if (!isSoftwareGl) {
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -shadowExtent;
    keyLight.shadow.camera.right = shadowExtent;
    keyLight.shadow.camera.top = shadowExtent;
    keyLight.shadow.camera.bottom = -shadowExtent;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 25;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
  }
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xa7dfc2, 0.75);
  rimLight.position.set(-6.0, 4.5, -5.5);
  scene.add(rimLight);

  return { envTex };
}

/**
 * Software-WebGL safe afterDraw pacing helper.
 * Waits for WebGL2 GPU fence completion before scheduling callback after an 80ms breather.
 */
export function createAfterDraw(renderer: THREE.WebGLRenderer) {
  let pendingTimer = 0;

  function schedule(cb: () => void) {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          pendingTimer = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          pendingTimer = window.setTimeout(cb, 80);
        }
      };
      pendingTimer = window.setTimeout(poll, 5);
    } else {
      pendingTimer = window.setTimeout(cb, 80);
    }
  }

  function cancel() {
    if (pendingTimer) {
      window.clearTimeout(pendingTimer);
      pendingTimer = 0;
    }
  }

  return { schedule, cancel };
}

/**
 * Generates procedural organic soil profile CanvasTexture (topsoil -> dark loam -> warm subsoil).
 */
export function createSoilStrataTextures(renderer: THREE.WebGLRenderer) {
  const w = 512;
  const h = 512;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = w;
  colorCanvas.height = h;
  const ctx = colorCanvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, '#3a291d');
  grad.addColorStop(0.22, '#4a3322');
  grad.addColorStop(0.65, '#593d29');
  grad.addColorStop(1.0, '#452e1f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Deterministic pseudo-random organic soil granules and pebbles
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 4200; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 0.8 + rand() * 3.4;
    const tone = rand();
    ctx.fillStyle =
      tone > 0.78
        ? 'rgba(138, 102, 72, 0.35)'
        : tone > 0.4
          ? 'rgba(38, 24, 15, 0.42)'
          : 'rgba(92, 64, 44, 0.32)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle horizontal moisture strata bands
  for (let y = 24; y < h; y += 34) {
    ctx.fillStyle = 'rgba(22, 14, 9, 0.14)';
    ctx.fillRect(0, y, w, 4 + rand() * 6);
  }

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const v = Math.floor(60 + rand() * 140);
    bCtx.fillStyle = `rgb(${v},${v},${v})`;
    bCtx.fillRect(x, y, 2 + rand() * 3, 2 + rand() * 3);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

/**
 * Generates procedural ESP32 PCB texture with copper traces, silkscreen pads, and chip markings.
 */
export function createPcbTexture(renderer: THREE.WebGLRenderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#12422d';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle copper ground plane grid
  ctx.strokeStyle = 'rgba(42, 130, 88, 0.45)';
  ctx.lineWidth = 2;
  for (let i = 24; i < 512; i += 28) {
    ctx.beginPath();
    ctx.moveTo(i, 20);
    ctx.lineTo(i, 492);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(20, i);
    ctx.lineTo(492, i);
    ctx.stroke();
  }

  // Gold solder pads around edges
  ctx.fillStyle = '#d4af52';
  for (let y = 52; y <= 460; y += 30) {
    ctx.beginPath();
    ctx.arc(36, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(476, y, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Silkscreen border
  ctx.strokeStyle = 'rgba(235, 245, 240, 0.72)';
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, 476, 476);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

/**
 * Creates a soft radial contact shadow disc texture so 3D prototypes sit grounded on the surface.
 */
export function createContactShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 122);
  grad.addColorStop(0, 'rgba(10, 22, 15, 0.52)');
  grad.addColorStop(0.55, 'rgba(10, 22, 15, 0.18)');
  grad.addColorStop(1, 'rgba(10, 22, 15, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
