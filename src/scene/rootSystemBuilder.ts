import * as THREE from 'three';

/**
 * Generates a tapered organic tube BufferGeometry along a 3D spline curve.
 * Radius tapers smoothly from radiusStart to radiusEnd with subtle natural organic modulation.
 */
function createTaperedTubeGeometry(
  curve: THREE.CatmullRomCurve3,
  tubularSegments: number,
  radiusStart: number,
  radiusEnd: number,
  radialSegments: number,
  wobbleSeed: number,
): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const vertexCount = (tubularSegments + 1) * (radialSegments + 1);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices: number[] = [];

  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();

  let ptrPos = 0;
  let ptrUv = 0;

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments;
    curve.getPointAt(u, P);
    N.copy(frames.normals[i]);
    B.copy(frames.binormals[i]);

    // Smooth non-linear biological taper + slight organic node swelling
    const baseRadius = THREE.MathUtils.lerp(radiusStart, radiusEnd, Math.pow(u, 0.82));
    const swell = 1 + 0.08 * Math.sin(u * Math.PI * 5 + wobbleSeed);
    const radius = Math.max(0.0025, baseRadius * swell);

    for (let j = 0; j <= radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2;
      const sin = Math.sin(v);
      const cos = -Math.cos(v);

      normal.x = cos * N.x + sin * B.x;
      normal.y = cos * N.y + sin * B.y;
      normal.z = cos * N.z + sin * B.z;
      normal.normalize();

      vertex.x = P.x + radius * normal.x;
      vertex.y = P.y + radius * normal.y;
      vertex.z = P.z + radius * normal.z;

      positions[ptrPos] = vertex.x;
      positions[ptrPos + 1] = vertex.y;
      positions[ptrPos + 2] = vertex.z;

      normals[ptrPos] = normal.x;
      normals[ptrPos + 1] = normal.y;
      normals[ptrPos + 2] = normal.z;
      ptrPos += 3;

      uvs[ptrUv] = u;
      uvs[ptrUv + 1] = j / radialSegments;
      ptrUv += 2;
    }
  }

  for (let j = 1; j <= tubularSegments; j++) {
    for (let i = 1; i <= radialSegments; i++) {
      const a = (radialSegments + 1) * (j - 1) + (i - 1);
      const b = (radialSegments + 1) * j + (i - 1);
      const c = (radialSegments + 1) * j + i;
      const d = (radialSegments + 1) * (j - 1) + i;
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Builds the procedural branching organic root system inside the rhizobox observation chamber.
 * Local coordinates are centered around the rhizobox interior:
 *   X in [-1.15, +1.15], Y in [0.35, 2.48], Z near +0.40..+0.47 (pressed near the viewing pane).
 */
export function buildProceduralRootSystem(
  primaryMat: THREE.Material,
  fineMat: THREE.Material,
): THREE.Group {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'RootSystemAssembly';
  const rand = seeded(202604);

  const addBranch = (
    points: THREE.Vector3[],
    rStart: number,
    rEnd: number,
    segments: number,
    radial: number,
    material: THREE.Material,
    seedVal: number,
  ) => {
    const curve = new THREE.CatmullRomCurve3(points);
    const geom = createTaperedTubeGeometry(curve, segments, rStart, rEnd, radial, seedVal);
    const mesh = new THREE.Mesh(geom, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    rootGroup.add(mesh);
    return curve;
  };

  // 1. Primary Taproot descending organically right along the viewing plane
  const taprootPoints = [
    new THREE.Vector3(0.0, 2.5, 0.36),
    new THREE.Vector3(-0.04, 2.24, 0.44),
    new THREE.Vector3(0.06, 1.92, 0.46),
    new THREE.Vector3(-0.05, 1.56, 0.45),
    new THREE.Vector3(0.07, 1.2, 0.46),
    new THREE.Vector3(-0.02, 0.85, 0.44),
    new THREE.Vector3(0.05, 0.56, 0.41),
    new THREE.Vector3(0.01, 0.38, 0.39),
  ];
  const tapCurve = addBranch(taprootPoints, 0.052, 0.011, 44, 10, primaryMat, 1.2);

  // Crown bulb where stem meets taproot
  const crownGeo = new THREE.SphereGeometry(0.072, 14, 12);
  crownGeo.scale(1.15, 0.82, 0.9);
  const crownMesh = new THREE.Mesh(crownGeo, primaryMat);
  crownMesh.position.set(0, 2.48, 0.36);
  rootGroup.add(crownMesh);

  // 2. Primary Lateral Roots branching off the taproot left and right
  const lateralConfigs = [
    { t: 0.08, dir: -1, reach: 0.86, drop: 0.62, r0: 0.031, zBias: 0.455 },
    { t: 0.12, dir: 1, reach: 0.92, drop: 0.58, r0: 0.032, zBias: 0.46 },
    { t: 0.22, dir: -1, reach: 1.04, drop: 0.78, r0: 0.029, zBias: 0.462 },
    { t: 0.27, dir: 1, reach: 0.98, drop: 0.72, r0: 0.028, zBias: 0.458 },
    { t: 0.38, dir: -1, reach: 0.95, drop: 0.74, r0: 0.026, zBias: 0.455 },
    { t: 0.44, dir: 1, reach: 1.06, drop: 0.82, r0: 0.026, zBias: 0.46 },
    { t: 0.55, dir: -1, reach: 0.84, drop: 0.64, r0: 0.022, zBias: 0.45 },
    { t: 0.62, dir: 1, reach: 0.82, drop: 0.56, r0: 0.022, zBias: 0.452 },
    { t: 0.74, dir: -1, reach: 0.62, drop: 0.44, r0: 0.018, zBias: 0.445 },
    { t: 0.8, dir: 1, reach: 0.58, drop: 0.38, r0: 0.017, zBias: 0.44 },
  ];

  lateralConfigs.forEach((cfg, idx) => {
    const origin = tapCurve.getPointAt(cfg.t);
    const pts: THREE.Vector3[] = [origin.clone()];
    const steps = 5;

    for (let s = 1; s <= steps; s++) {
      const f = s / steps;
      const x = THREE.MathUtils.clamp(
        origin.x + cfg.dir * cfg.reach * Math.pow(f, 0.85) + (rand() - 0.5) * 0.08,
        -1.12,
        1.12,
      );
      const y = Math.max(
        0.34,
        origin.y - cfg.drop * Math.pow(f, 1.35) + Math.sin(f * Math.PI * 2 + idx) * 0.04,
      );
      const z = THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(origin.z, cfg.zBias, f) + (rand() - 0.5) * 0.035,
        0.32,
        0.472,
      );
      pts.push(new THREE.Vector3(x, y, z));
    }

    const latCurve = addBranch(pts, cfg.r0, 0.0065, 24, 8, primaryMat, idx * 2.1);

    // 3. Secondary & fine tertiary roots growing off each lateral root
    const subCount = idx < 6 ? 4 : 2;
    for (let k = 0; k < subCount; k++) {
      const st = 0.22 + (k / subCount) * 0.62;
      const subOrigin = latCurve.getPointAt(st);
      const subDirX = cfg.dir * (0.4 + rand() * 0.65) + (rand() - 0.5) * 0.55;
      const subLen = 0.22 + rand() * 0.34;
      const subDrop = 0.22 + rand() * 0.32;

      const sPts = [
        subOrigin.clone(),
        new THREE.Vector3(
          THREE.MathUtils.clamp(subOrigin.x + subDirX * subLen * 0.45, -1.14, 1.14),
          Math.max(0.32, subOrigin.y - subDrop * 0.45),
          THREE.MathUtils.clamp(subOrigin.z + (rand() - 0.35) * 0.03, 0.34, 0.474),
        ),
        new THREE.Vector3(
          THREE.MathUtils.clamp(subOrigin.x + subDirX * subLen, -1.14, 1.14),
          Math.max(0.3, subOrigin.y - subDrop),
          THREE.MathUtils.clamp(subOrigin.z + (rand() - 0.4) * 0.04, 0.34, 0.474),
        ),
      ];
      const subCurve = addBranch(
        sPts,
        cfg.r0 * 0.46,
        0.0032,
        12,
        6,
        fineMat,
        idx * 7 + k,
      );

      // Tertiary rootlet hair fork
      if (k % 2 === 0) {
        const tipOrigin = subCurve.getPointAt(0.55);
        const tPts = [
          tipOrigin.clone(),
          new THREE.Vector3(
            THREE.MathUtils.clamp(tipOrigin.x + (rand() - 0.5) * 0.22, -1.14, 1.14),
            Math.max(0.3, tipOrigin.y - (0.1 + rand() * 0.14)),
            THREE.MathUtils.clamp(tipOrigin.z + 0.008, 0.35, 0.475),
          ),
          new THREE.Vector3(
            THREE.MathUtils.clamp(tipOrigin.x + (rand() - 0.5) * 0.34, -1.14, 1.14),
            Math.max(0.28, tipOrigin.y - (0.2 + rand() * 0.18)),
            THREE.MathUtils.clamp(tipOrigin.z + 0.01, 0.35, 0.475),
          ),
        ];
        addBranch(tPts, 0.0075, 0.0024, 8, 5, fineMat, idx * 13 + k);
      }
    }
  });

  // 4. Mid-soil deeper depth roots (gives parallax 3D depth when orbiting or exploding)
  for (let d = 0; d < 4; d++) {
    const side = d % 2 === 0 ? -1 : 1;
    const start = tapCurve.getPointAt(0.18 + d * 0.17);
    const deepPts = [
      start.clone(),
      new THREE.Vector3(start.x + side * 0.32, start.y - 0.24, 0.26),
      new THREE.Vector3(start.x + side * 0.58, start.y - 0.58, 0.14),
      new THREE.Vector3(start.x + side * 0.46, Math.max(0.35, start.y - 0.92), 0.18),
    ];
    addBranch(deepPts, 0.022, 0.005, 16, 6, primaryMat, 40 + d);
  }

  return rootGroup;
}

/**
 * Builds a botanical crop seedling emerging from the top of the rhizobox soil collar.
 */
export function buildCropSeedling(
  stemMat: THREE.Material,
  leafMat: THREE.Material,
): THREE.Group {
  const shoot = new THREE.Group();
  shoot.name = 'CropSeedlingShoot';

  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 2.48, 0.35),
    new THREE.Vector3(0.02, 2.74, 0.34),
    new THREE.Vector3(-0.02, 3.02, 0.35),
    new THREE.Vector3(0.01, 3.24, 0.33),
  ]);
  const stemGeo = createTaperedTubeGeometry(stemCurve, 18, 0.042, 0.016, 8, 0.5);
  const stemMesh = new THREE.Mesh(stemGeo, stemMat);
  stemMesh.castShadow = true;
  shoot.add(stemMesh);

  // Build sculpted leaf blade geometry with subtle midrib curve
  const createLeafMesh = (length: number, width: number, arch: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(width * 0.75, length * 0.22, width * 0.85, length * 0.68, 0, length);
    shape.bezierCurveTo(-width * 0.85, length * 0.68, -width * 0.75, length * 0.22, 0, 0);

    const geo = new THREE.ShapeGeometry(shape, 10);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const ly = pos.getY(i);
      const t = ly / length;
      // Graceful downward arch + slight cup across leaf width
      const zCurve = -arch * t * t + Math.abs(lx) * 0.18;
      pos.setZ(i, zCurve);
    }
    geo.computeVertexNormals();
    const leaf = new THREE.Mesh(geo, leafMat);
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    return leaf;
  };

  const leafSpecs = [
    { y: 2.8, rotY: 0.4, tiltX: 0.85, len: 0.46, wid: 0.18, arch: 0.16 },
    { y: 2.86, rotY: 2.55, tiltX: 0.9, len: 0.44, wid: 0.17, arch: 0.15 },
    { y: 3.02, rotY: 4.5, tiltX: 0.76, len: 0.42, wid: 0.16, arch: 0.13 },
    { y: 3.12, rotY: 1.4, tiltX: 0.65, len: 0.34, wid: 0.13, arch: 0.1 },
    { y: 3.2, rotY: 3.6, tiltX: 0.52, len: 0.28, wid: 0.11, arch: 0.08 },
  ];

  leafSpecs.forEach((spec) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, spec.y, 0.34);
    pivot.rotation.y = spec.rotY;
    const leaf = createLeafMesh(spec.len, spec.wid, spec.arch);
    leaf.rotation.x = spec.tiltX;
    pivot.add(leaf);
    shoot.add(pivot);
  });

  return shoot;
}
