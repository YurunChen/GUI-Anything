import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import claudeCodeLogo from './assets/hero/claudecode-color.svg';

/** Scene anchor — tree tucked into the right third, clear of hero copy */
const TREE_X = 124;
const TREE_HEART = new THREE.Vector3(TREE_X, 50, 0);
const CAMERA_BASE = new THREE.Vector3(172, 96, 202);
const GROUND_CENTER = new THREE.Vector3(72, -310, 0);
const GROUND_RADIUS = 320;
const VIEW_COMPOSITION_X = -26;

const EMBER = 0xb06849;
const THINK = 0xe8bb61;
const SAGE = 0x3f9a63;
const SAGE_LIGHT = 0x79c78c;
const ZELDA_LEAF = 0xa6d49e;
const SAGE_PALE = 0xd2ebc8;
const TRUNK = 0x826a50;
const BARK_DARK = 0x5f4b3b;
const OUTLINE = 0x2f5142;
const ROCK = 0x9aa9a8;
const ROCK_MOSS = 0x739f78;
const BUSH = 0x347f52;
const FLOWER = 0xd99b76;
const SKY_HAZE = 0xdaeff9;
const CLAUDE_POS = new THREE.Vector3(-92, 38, 36);

const MOTE_CORE_GEO = new THREE.SphereGeometry(1, 8, 6);
const MOTE_HALO_GEO = new THREE.SphereGeometry(1, 8, 6);
const GATHER_TRAIL_LEN = 16;
const _camOffset = new THREE.Vector3();
const _lookAt = new THREE.Vector3();
const _rotY = new THREE.Matrix4();
const _mouseRay = new THREE.Raycaster();
const _mouseNdc = new THREE.Vector2();
const _gatherPoint = new THREE.Vector3();
const _orbitBase = new THREE.Vector3();
const _pullDir = new THREE.Vector3();
const _gatherPlane = new THREE.Plane();
const _camDir = new THREE.Vector3();

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function createToonGradient() {
  const colors = new Uint8Array([72, 138, 96, 148, 190, 136, 218, 234, 206, 255, 255, 255]);
  const tex = new THREE.DataTexture(colors, 4, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

function createGroundTexture() {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(w * 0.62, h * 0.55, w * 0.03, w * 0.52, h * 0.5, w * 0.55);
  grad.addColorStop(0, '#e0f2e6');
  grad.addColorStop(0.35, '#c8e5cd');
  grad.addColorStop(0.7, '#a8d3b1');
  grad.addColorStop(1, '#86bd95');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 120; i += 1) {
    const x = w * 0.35 + Math.random() * w * 0.45;
    const y = h * 0.35 + Math.random() * h * 0.35;
    ctx.fillStyle = `rgba(${72 + Math.random() * 34},${132 + Math.random() * 42},${92 + Math.random() * 28},0.1)`;
    ctx.beginPath();
    ctx.ellipse(x, y, 2 + Math.random() * 5, 1 + Math.random() * 3, Math.random(), 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createMaterialPool(gradientMap) {
  const toon = (color, emissive = 0x000000, emissiveIntensity = 0) => new THREE.MeshToonMaterial({
    color,
    gradientMap,
    emissive,
    emissiveIntensity,
  });
  return {
    gradientMap,
    toon,
    outline: new THREE.MeshBasicMaterial({
      color: OUTLINE,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.35,
    }),
    moteCore: new Map(),
    moteHalo: new Map(),
    list: [],
  };
}

function trackMaterial(pool, mat) {
  pool.list.push(mat);
  return mat;
}

function softMesh(geometry, material, pool, options = {}) {
  const { outline = 0.45 } = options;
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, material));
  if (outline > 0) {
    const outlineMesh = new THREE.Mesh(geometry, pool.outline);
    const scale = 1 + outline * 0.008;
    outlineMesh.scale.set(scale, scale, scale);
    group.add(outlineMesh);
  }
  return group;
}

function createMote(size, color, haloStrength, pool) {
  const group = new THREE.Group();

  if (!pool.moteCore.has(color)) {
    pool.moteCore.set(color, trackMaterial(pool, new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.88,
    })));
    pool.moteHalo.set(color, trackMaterial(pool, new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: haloStrength,
      depthWrite: false,
    })));
  }

  const haloMesh = new THREE.Mesh(MOTE_HALO_GEO, pool.moteHalo.get(color));
  haloMesh.scale.setScalar(size * 2.2);
  const coreMesh = new THREE.Mesh(MOTE_CORE_GEO, pool.moteCore.get(color));
  coreMesh.scale.setScalar(size * 0.65);

  group.add(haloMesh, coreMesh);
  group.userData = { core: coreMesh, halo: haloMesh, baseHalo: haloStrength, baseSize: size };
  return group;
}

const TREE_ORBIT_BANDS = [
  { count: 6, radius: 22, centerY: 34, speed: 0.28, zFlat: 0.52, color: SAGE, size: 0.9 },
  { count: 7, radius: 30, centerY: 52, speed: -0.22, zFlat: 0.48, color: SAGE_LIGHT, size: 1.0 },
  { count: 6, radius: 38, centerY: 68, speed: 0.18, zFlat: 0.44, color: THINK, size: 1.05 },
  { count: 5, radius: 46, centerY: 82, speed: -0.15, zFlat: 0.4, color: EMBER, size: 0.95 },
];

const DRIFT_MOTE_COUNT = 12;

function createGatherTrail() {
  return Array.from({ length: GATHER_TRAIL_LEN }, () => new THREE.Vector3());
}

function pushGatherTrail(pointer, point) {
  pointer.trailHead = (pointer.trailHead + 1) % GATHER_TRAIL_LEN;
  pointer.trail[pointer.trailHead].copy(point);
}

function sampleGatherTrail(pointer, lag, out) {
  const idx = (pointer.trailHead - lag + GATHER_TRAIL_LEN * 64) % GATHER_TRAIL_LEN;
  out.copy(pointer.trail[idx]);
}

function buildTreeOrbitSystem(pool) {
  const motes = [];
  let moteIndex = 0;
  for (const [bandIndex, band] of TREE_ORBIT_BANDS.entries()) {
    for (let i = 0; i < band.count; i += 1) {
      const mote = createMote(
        band.size + (i % 2) * 0.12,
        band.color,
        0.1 + (i % 3) * 0.03,
        pool,
      );
      Object.assign(mote.userData, {
        band,
        phase: (i / band.count) * Math.PI * 2 + bandIndex * 0.4,
        bandIndex,
        trailLag: Math.min(GATHER_TRAIL_LEN - 1, Math.floor(moteIndex * 0.55 + bandIndex * 1.6)),
        vx: 0,
        vy: 0,
        vz: 0,
      });
      motes.push(mote);
      moteIndex += 1;
    }
  }

  const driftColors = [SAGE, SAGE_LIGHT, THINK, EMBER];
  for (let i = 0; i < DRIFT_MOTE_COUNT; i += 1) {
    const mote = createMote(
      0.5 + (i % 4) * 0.12,
      driftColors[i % driftColors.length],
      0.12 + (i % 3) * 0.025,
      pool,
    );
    const spread = 48 + (i % 5) * 6;
    const ang = (i / DRIFT_MOTE_COUNT) * Math.PI * 2 + i * 0.7;
    Object.assign(mote.userData, {
      drift: true,
      phase: i * 1.37,
      anchorX: TREE_X + Math.cos(ang) * spread * 0.55,
      anchorY: 36 + (i % 6) * 9,
      anchorZ: Math.sin(ang) * spread * 0.35,
      wander: 5 + (i % 4) * 2.5,
      trailLag: Math.min(GATHER_TRAIL_LEN - 1, 2 + (i % 7)),
      vx: 0,
      vy: 0,
      vz: 0,
    });
    mote.position.set(mote.userData.anchorX, mote.userData.anchorY, mote.userData.anchorZ);
    motes.push(mote);
  }

  return { motes };
}

function buildGatherBeacon(pool) {
  const beacon = new THREE.Group();
  const ringMat = trackMaterial(pool, new THREE.MeshBasicMaterial({
    color: THINK,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.8, 5.2, 28), ringMat);
  ring.rotation.x = -Math.PI / 2;
  beacon.add(ring);

  const coreMat = trackMaterial(pool, new THREE.MeshBasicMaterial({
    color: SAGE_LIGHT,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  const core = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20), coreMat);
  core.rotation.x = -Math.PI / 2;
  beacon.add(core);

  return { beacon, ring, core };
}

function resolveMouseGatherPoint(camera, pointer, out) {
  _mouseNdc.set(pointer.ndcX, pointer.ndcY);
  _mouseRay.setFromCamera(_mouseNdc, camera);
  camera.getWorldDirection(_camDir);
  _gatherPlane.setFromNormalAndCoplanarPoint(_camDir, TREE_HEART);
  if (!_mouseRay.ray.intersectPlane(_gatherPlane, out)) {
    out.copy(TREE_HEART);
  }
  out.x = THREE.MathUtils.clamp(out.x, TREE_X - 52, TREE_X + 58);
  out.y = THREE.MathUtils.clamp(out.y, 22, 96);
  out.z = THREE.MathUtils.clamp(out.z, -38, 38);
  return out;
}

function updateTreeOrbitMote(mote, t, speedMul, gather, gatherStrength) {
  const { band, phase, vx, vy, vz } = mote.userData;
  const ang = phase + t * band.speed * speedMul;
  _orbitBase.set(
    TREE_X + Math.cos(ang) * band.radius,
    band.centerY,
    Math.sin(ang) * band.radius * band.zFlat,
  );

  let tx = _orbitBase.x;
  let ty = _orbitBase.y;
  let tz = _orbitBase.z;

  if (gatherStrength > 0.02) {
    _pullDir.set(gather.x - _orbitBase.x, gather.y - _orbitBase.y, gather.z - _orbitBase.z);
    const dist = _pullDir.length();
    const falloff = THREE.MathUtils.smoothstep(96, 8, dist);
    const heightBias = 0.38 + (band.centerY - 28) / 68;
    const blend = gatherStrength * (0.32 + falloff * 0.78) * heightBias;
    tx = THREE.MathUtils.lerp(_orbitBase.x, gather.x, blend);
    ty = THREE.MathUtils.lerp(_orbitBase.y, gather.y, blend);
    tz = THREE.MathUtils.lerp(_orbitBase.z, gather.z, blend);
  }

  const spring = 0.022 + gatherStrength * 0.042;
  const damp = 0.78 - gatherStrength * 0.1;
  mote.userData.vx = vx * damp + (tx - mote.position.x) * spring;
  mote.userData.vy = vy * damp + (ty - mote.position.y) * spring;
  mote.userData.vz = vz * damp + (tz - mote.position.z) * spring;
  mote.position.x += mote.userData.vx;
  mote.position.y += mote.userData.vy;
  mote.position.z += mote.userData.vz;

  const distToGather = mote.position.distanceTo(gather);
  const clusterGlow = gatherStrength > 0.12
    ? THREE.MathUtils.smoothstep(36, 4, distToGather) * gatherStrength * 0.28
    : 0;
  if (speedMul > 1.05 || clusterGlow > 0) {
    const boost = Math.min((speedMul - 1) * 0.35, 0.14) + clusterGlow;
    mote.userData.halo.material.opacity = mote.userData.baseHalo + boost;
    const scale = 1 + clusterGlow * 0.45;
    mote.userData.core.scale.setScalar(mote.userData.baseSize * 0.65 * scale);
  } else {
    mote.userData.halo.material.opacity = mote.userData.baseHalo;
    mote.userData.core.scale.setScalar(mote.userData.baseSize * 0.65);
  }
}

function updateDriftMote(mote, t, gather, gatherStrength) {
  const { phase, anchorX, anchorY, anchorZ, wander, vx, vy, vz } = mote.userData;
  _orbitBase.set(
    anchorX + Math.sin(t * 0.35 + phase) * wander,
    anchorY + Math.sin(t * 0.28 + phase * 1.3) * wander * 0.45,
    anchorZ + Math.cos(t * 0.32 + phase) * wander * 0.55,
  );

  let tx = _orbitBase.x;
  let ty = _orbitBase.y;
  let tz = _orbitBase.z;

  if (gatherStrength > 0.02) {
    const blend = gatherStrength * 0.82;
    tx = THREE.MathUtils.lerp(_orbitBase.x, gather.x, blend);
    ty = THREE.MathUtils.lerp(_orbitBase.y, gather.y, blend);
    tz = THREE.MathUtils.lerp(_orbitBase.z, gather.z, blend);
  }

  const spring = 0.028 + gatherStrength * 0.05;
  const damp = 0.74 - gatherStrength * 0.12;
  mote.userData.vx = vx * damp + (tx - mote.position.x) * spring;
  mote.userData.vy = vy * damp + (ty - mote.position.y) * spring;
  mote.userData.vz = vz * damp + (tz - mote.position.z) * spring;
  mote.position.x += mote.userData.vx;
  mote.position.y += mote.userData.vy;
  mote.position.z += mote.userData.vz;

  const distToGather = mote.position.distanceTo(gather);
  const clusterGlow = gatherStrength > 0.1
    ? THREE.MathUtils.smoothstep(28, 3, distToGather) * gatherStrength * 0.32
    : 0;
  mote.userData.halo.material.opacity = mote.userData.baseHalo + clusterGlow;
  mote.userData.core.scale.setScalar(mote.userData.baseSize * 0.65 * (1 + clusterGlow * 0.5));
}

function buildGround(pool, groundTexture) {
  const ground = new THREE.Group();
  ground.position.copy(GROUND_CENTER);
  const groundMat = trackMaterial(pool, new THREE.MeshToonMaterial({
    color: 0xffffff,
    gradientMap: pool.gradientMap,
    map: groundTexture,
  }));
  ground.add(softMesh(
    new THREE.SphereGeometry(GROUND_RADIUS, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2.2),
    groundMat,
    pool,
    { outline: 0 },
  ));
  return ground;
}

function addGrassTufts(parent, pool, centerX, centerZ, count, radius) {
  const geo = new THREE.ConeGeometry(0.4, 1.1, 4);
  const mat = trackMaterial(pool, pool.toon(SAGE_LIGHT));
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i += 1) {
    const ang = (i / count) * Math.PI * 2 + (i % 3) * 0.4;
    const dist = 6 + (i % 7) * (radius / count);
    dummy.position.set(
      centerX + Math.cos(ang) * dist,
      0.55 + (i % 4) * 0.15,
      centerZ + Math.sin(ang) * dist * 0.5,
    );
    dummy.rotation.y = ang;
    dummy.scale.setScalar(0.7 + (i % 5) * 0.18);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  parent.add(mesh);
  return geo;
}

function addRock(parent, pool, x, y, z, sx, sy, sz, color = ROCK) {
  const rock = softMesh(
    new THREE.DodecahedronGeometry(1, 0),
    trackMaterial(pool, pool.toon(color)),
    pool,
    { outline: 0.12 },
  );
  rock.position.set(x, y, z);
  rock.rotation.set(0.2, z * 0.1, 0.15);
  rock.scale.set(sx, sy, sz);
  parent.add(rock);
}

function addBush(parent, pool, x, y, z, scale) {
  const bush = new THREE.Group();
  for (const [i, off] of [[0, 0], [0.8, 0.5], [-0.7, 0.4]].entries()) {
    const puff = softMesh(
      new THREE.IcosahedronGeometry(1.8 - i * 0.25, 0),
      trackMaterial(pool, pool.toon(i === 0 ? BUSH : SAGE)),
      pool,
      { outline: 0.1 },
    );
    puff.position.set(off[0], i * 0.35, off[1]);
    bush.add(puff);
  }
  bush.position.set(x, y, z);
  bush.scale.setScalar(scale);
  parent.add(bush);
  return bush;
}

function addFlower(parent, pool, x, y, z) {
  const stem = softMesh(
    new THREE.CylinderGeometry(0.08, 0.1, 0.9, 4),
    trackMaterial(pool, pool.toon(SAGE)),
    pool,
    { outline: 0 },
  );
  stem.position.set(x, y + 0.45, z);
  parent.add(stem);
  const bloom = softMesh(
    new THREE.SphereGeometry(0.35, 6, 5),
    trackMaterial(pool, pool.toon(FLOWER, FLOWER, 0.08)),
    pool,
    { outline: 0 },
  );
  bloom.position.set(x, y + 1.05, z);
  parent.add(bloom);
}

function buildFloatingIsland(pool, x, y, z, scale, variant = 'near') {
  const island = new THREE.Group();
  island.position.set(x, y, z);
  island.scale.setScalar(scale);
  island.rotation.y = x * 0.013 + z * 0.017;

  const top = softMesh(
    new THREE.DodecahedronGeometry(8, 0),
    trackMaterial(pool, pool.toon(variant === 'near' ? SAGE_LIGHT : 0x8fc296)),
    pool,
    { outline: 0.08 },
  );
  top.scale.set(1.55, 0.32, 0.72);
  top.position.y = 1.4;
  island.add(top);

  const stone = softMesh(
    new THREE.ConeGeometry(6.8, 13, 7),
    trackMaterial(pool, pool.toon(variant === 'near' ? ROCK_MOSS : ROCK)),
    pool,
    { outline: 0.12 },
  );
  stone.position.y = -5.2;
  stone.rotation.x = Math.PI;
  stone.scale.set(1.08, 1, 0.72);
  island.add(stone);

  const lip = softMesh(
    new THREE.CylinderGeometry(8.6, 7.4, 1.4, 9),
    trackMaterial(pool, pool.toon(0x6aa977)),
    pool,
    { outline: 0 },
  );
  lip.position.y = 2.9;
  lip.scale.set(1.45, 1, 0.62);
  island.add(lip);

  if (variant === 'near') {
    addBush(island, pool, -4.8, 3.2, 0.6, 0.42);
    addBush(island, pool, 4.4, 3.2, -0.8, 0.35);
  }

  island.userData = {
    baseY: y,
    baseRotationY: island.rotation.y,
    phase: x * 0.017 + z * 0.011,
    drift: variant === 'near' ? 0.55 : 0.34,
    speed: variant === 'near' ? 0.2 : 0.15,
    spin: (variant === 'near' ? 0.058 : 0.034) * (x > TREE_X ? 1 : -1),
  };

  return island;
}

function buildFloatingIslands(pool) {
  const group = new THREE.Group();
  const islands = [
    buildFloatingIsland(pool, TREE_X - 82, 46, -34, 0.72, 'far'),
    buildFloatingIsland(pool, TREE_X - 42, 34, 28, 0.58, 'far'),
    buildFloatingIsland(pool, TREE_X + 36, 40, -54, 0.52, 'far'),
    buildFloatingIsland(pool, TREE_X + 78, 30, 18, 0.44, 'far'),
    buildFloatingIsland(pool, TREE_X + 94, 56, -18, 0.38, 'far'),
  ];

  for (const island of islands) {
    group.add(island);
  }

  return { group, islands };
}

function buildZeldaTree(pool, x, z, scale, variant = 'hero') {
  const tree = new THREE.Group();
  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);

  const trunkH = variant === 'hero' ? 54 : 38;
  const trunkMesh = softMesh(
    new THREE.CylinderGeometry(variant === 'hero' ? 3.4 : 2.2, variant === 'hero' ? 5 : 3.2, trunkH, 8),
    trackMaterial(pool, pool.toon(TRUNK)),
    pool,
    { outline: 0.28 },
  );
  trunkMesh.position.y = trunkH * 0.5;
  tree.add(trunkMesh);

  if (variant === 'hero') {
    const roots = softMesh(
      new THREE.CylinderGeometry(4.8, 2.8, 3.5, 7),
      trackMaterial(pool, pool.toon(BARK_DARK)),
      pool,
      { outline: 0.15 },
    );
    roots.position.y = 1.8;
    tree.add(roots);
  }

  const branches = variant === 'hero'
    ? [
      { y: 28, ry: 0.8, rz: -0.55, len: 11, r: 1.6 },
      { y: 38, ry: -0.9, rz: 0.5, len: 9, r: 1.3 },
      { y: 46, ry: 0.4, rz: -0.35, len: 7.5, r: 1.1 },
    ]
    : [{ y: 22, ry: 0.6, rz: -0.4, len: 6, r: 0.9 }];
  for (const branch of branches) {
    const limb = softMesh(
      new THREE.CylinderGeometry(branch.r * 0.45, branch.r, branch.len, 6),
      trackMaterial(pool, pool.toon(BARK_DARK)),
      pool,
      { outline: 0.12 },
    );
    limb.position.y = branch.y;
    limb.rotation.set(0, branch.ry, branch.rz);
    limb.translateY(branch.len * 0.4);
    tree.add(limb);
  }

  const canopy = new THREE.Group();
  canopy.position.y = variant === 'hero' ? 4 : 2;
  const canopyPuffs = [];
  const puffDefs = variant === 'hero'
    ? [
      { x: 0, y: 56, z: 0, r: 24, color: SAGE },
      { x: 14, y: 60, z: 5, r: 18, color: SAGE_LIGHT },
      { x: -12, y: 58, z: -4, r: 19, color: 0x448f5f },
      { x: 8, y: 70, z: -6, r: 16, color: ZELDA_LEAF },
      { x: -8, y: 68, z: 5, r: 15, color: SAGE_LIGHT },
      { x: 0, y: 78, z: 2, r: 13, color: SAGE_PALE },
      { x: 18, y: 66, z: -2, r: 12, color: ZELDA_LEAF },
      { x: -15, y: 72, z: 1, r: 11, color: SAGE_PALE },
    ]
    : [
      { x: 0, y: 38, z: 0, r: 14, color: SAGE_LIGHT },
      { x: 6, y: 42, z: 3, r: 10, color: ZELDA_LEAF },
      { x: -5, y: 40, z: -2, r: 11, color: SAGE },
    ];
  for (const [i, c] of puffDefs.entries()) {
    const puff = softMesh(
      new THREE.IcosahedronGeometry(c.r, 1),
      trackMaterial(pool, pool.toon(c.color)),
      pool,
      { outline: 0.16 },
    );
    puff.position.set(c.x, c.y, c.z);
    puff.userData = {
      baseX: c.x, baseY: c.y, baseZ: c.z,
      phase: i * 0.7, speed: 0.12 + (i % 3) * 0.03,
      sway: variant === 'hero' ? 1 : 0.45,
    };
    canopy.add(puff);
    canopyPuffs.push(puff);
  }

  if (variant === 'hero') {
    for (const f of [
      { x: 5, y: 64, z: 4 },
      { x: -4, y: 72, z: -2 },
      { x: 10, y: 68, z: -1 },
    ]) {
      const fruit = softMesh(
        new THREE.SphereGeometry(1.5, 6, 5),
        trackMaterial(pool, pool.toon(THINK, THINK, 0.1)),
        pool,
        { outline: 0.1 },
      );
      fruit.position.set(f.x, f.y, f.z);
      canopy.add(fruit);
    }
  }

  tree.add(canopy);
  return { tree, canopy, canopyPuffs };
}

function buildZeldaGrove(pool) {
  const grove = new THREE.Group();
  const rootRings = [];

  for (let i = 0; i < 2; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(10 + i * 7, 10.6 + i * 7, 32),
      trackMaterial(pool, new THREE.MeshBasicMaterial({
        color: SAGE_LIGHT,
        transparent: true,
        opacity: 0.05 - i * 0.012,
        depthWrite: false,
        side: THREE.DoubleSide,
      })),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(TREE_X, 1.8 + i * 0.35, 0);
    grove.add(ring);
    rootRings.push(ring);
  }

  const hero = buildZeldaTree(pool, TREE_X, 0, 1.05, 'hero');
  hero.tree.userData.interactive = true;
  grove.add(hero.tree);

  const bg1 = buildZeldaTree(pool, TREE_X + 32, -14, 0.62, 'bg');
  const bg2 = buildZeldaTree(pool, TREE_X + 38, 10, 0.55, 'bg');
  grove.add(bg1.tree, bg2.tree);

  addBush(grove, pool, TREE_X - 10, 1.2, 8, 1.1);
  addBush(grove, pool, TREE_X + 8, 1, -10, 0.95);
  addBush(grove, pool, TREE_X + 22, 0.8, 6, 0.75);

  addRock(grove, pool, TREE_X - 14, 1.4, 12, 2.8, 1.6, 2.2, ROCK);
  addRock(grove, pool, TREE_X + 6, 1.1, -14, 2.2, 1.4, 1.8, ROCK_MOSS);
  addRock(grove, pool, TREE_X + 20, 1, 4, 1.6, 1.1, 1.4, ROCK);
  addRock(grove, pool, TREE_X - 6, 1.2, -8, 1.4, 0.9, 1.2, ROCK_MOSS);

  for (const f of [
    [TREE_X - 8, 0, 14], [TREE_X + 4, 0, -6], [TREE_X + 16, 0, 10],
    [TREE_X - 2, 0, -12], [TREE_X + 24, 0, -4],
  ]) {
    addFlower(grove, pool, f[0], f[1], f[2]);
  }

  const grassGeo = addGrassTufts(grove, pool, TREE_X, 0, 36, 26);

  return {
    grove,
    rootRings,
    canopyPuffs: [...hero.canopyPuffs, ...bg1.canopyPuffs, ...bg2.canopyPuffs],
    grassGeo,
  };
}

function buildKnowledgeTree(pool) {
  const { grove, rootRings, canopyPuffs } = buildZeldaGrove(pool);
  return { tree: grove, rootRings, canopyPuffs };
}

function buildClaudeSource(pool) {
  const source = new THREE.Group();
  source.position.copy(CLAUDE_POS);
  source.userData.interactive = true;

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(3.5, 10, 8),
    trackMaterial(pool, new THREE.MeshBasicMaterial({
      color: EMBER,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    })),
  );
  source.add(glow);

  const core = softMesh(
    new THREE.CylinderGeometry(4, 5, 1.8, 8),
    trackMaterial(pool, pool.toon(0xf4f5f7)),
    pool,
    { outline: 0.2 },
  );
  core.position.y = -1.2;
  source.add(core);
  source.userData.glow = glow;
  return source;
}

function addBillboard(group, texture, width, height, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: 0.92,
    }),
  );
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function applyCameraPose(camera, pointer) {
  const yaw = pointer.yaw;
  const pitch = pointer.pitch;

  _camOffset.copy(CAMERA_BASE).sub(TREE_HEART);
  _rotY.makeRotationY(yaw);
  _camOffset.applyMatrix4(_rotY);
  _camOffset.y += pitch * 28;

  camera.position.copy(TREE_HEART).add(_camOffset);

  _lookAt.copy(TREE_HEART);
  _lookAt.x += VIEW_COMPOSITION_X + yaw * 22 + pointer.smoothParallaxX * 18;
  _lookAt.y += pitch * 16 - pointer.smoothParallaxY * 12;
  if (pointer.gatherStrength > 0.06) {
    const gaze = pointer.gatherStrength * 0.14;
    _lookAt.x += (pointer.gatherX - TREE_HEART.x) * gaze;
    _lookAt.y += (pointer.gatherY - TREE_HEART.y) * gaze * 0.85;
    _lookAt.z += (pointer.gatherZ - TREE_HEART.z) * gaze * 0.5;
  }
  camera.lookAt(_lookAt);
}

function bindHeroInteraction(host, canvas, pointer, reduced) {
  const maxYaw = 0.45;
  const maxPitch = 0.2;
  let pointerId = null;

  const setDragging = (on) => {
    pointer.dragging = on;
    host.classList.toggle('is-dragging', on);
  };

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    pointerId = e.pointerId;
    pointer.lastX = e.clientX;
    pointer.lastY = e.clientY;
    setDragging(true);
    canvas.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const rect = host.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;

    pointer.ndcX = nx;
    pointer.ndcY = -ny;
    pointer.targetGatherStrength = pointer.mouseActive
      ? THREE.MathUtils.smoothstep(nx, 0.12, 0.72)
      : 0;

    if (pointer.dragging && e.pointerId === pointerId) {
      const dx = e.clientX - pointer.lastX;
      const dy = e.clientY - pointer.lastY;
      pointer.targetYaw = THREE.MathUtils.clamp(
        pointer.targetYaw + dx * 0.0045,
        -maxYaw,
        maxYaw,
      );
      pointer.targetPitch = THREE.MathUtils.clamp(
        pointer.targetPitch + dy * 0.0035,
        -maxPitch,
        maxPitch,
      );
    }

    if (!reduced) {
      pointer.parallaxX = nx * 0.11;
      pointer.parallaxY = ny * 0.075;
      pointer.hoverTree = nx > 0.14;
      pointer.smoothParallaxX += (pointer.parallaxX - pointer.smoothParallaxX) * 0.07;
      pointer.smoothParallaxY += (pointer.parallaxY - pointer.smoothParallaxY) * 0.07;
    }

    pointer.lastX = e.clientX;
    pointer.lastY = e.clientY;
  };

  const onPointerUp = (e) => {
    if (e.pointerId !== pointerId) return;
    setDragging(false);
    pointerId = null;
    canvas.releasePointerCapture?.(e.pointerId);
  };

  const onDoubleClick = () => {
    pointer.targetYaw = 0;
    pointer.targetPitch = 0;
    pointer.pulse = 1;
  };

  const onWheel = (e) => {
    e.preventDefault();
    pointer.targetYaw = THREE.MathUtils.clamp(
      pointer.targetYaw + e.deltaX * 0.0012,
      -maxYaw,
      maxYaw,
    );
    pointer.targetPitch = THREE.MathUtils.clamp(
      pointer.targetPitch + e.deltaY * 0.001,
      -maxPitch,
      maxPitch,
    );
  };

  const onPointerEnter = () => {
    pointer.mouseActive = true;
  };

  const onPointerLeave = (e) => {
    pointer.mouseActive = false;
    pointer.targetGatherStrength = 0;
    onPointerUp(e);
  };

  canvas.addEventListener('pointerenter', onPointerEnter);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('dblclick', onDoubleClick);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  return () => {
    canvas.removeEventListener('pointerenter', onPointerEnter);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('dblclick', onDoubleClick);
    canvas.removeEventListener('wheel', onWheel);
    setDragging(false);
  };
}

export function HeroDirectionAnimation({ ariaLabel, className = '' }) {
  return <HeroDirectionAnimationScene ariaLabel={ariaLabel} className={className} />;
}

function HeroDirectionAnimationScene({ ariaLabel, className = '' }) {
  const hostRef = useRef(null);
  const canvasMountRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    const mount = canvasMountRef.current;
    if (!host || !mount) return undefined;

    let raf = 0;
    let ro = null;
    let io = null;
    let unbindPointer = null;
    let renderer = null;
    let scene = null;
    let mounted = true;
    let disposed = false;
    let inView = true;
    let tabVisible = true;
    const disposables = [];
    const pointer = {
      yaw: 0,
      pitch: 0,
      targetYaw: 0,
      targetPitch: 0,
      parallaxX: 0,
      parallaxY: 0,
      smoothParallaxX: 0,
      smoothParallaxY: 0,
      ndcX: 0,
      ndcY: 0,
      mouseActive: false,
      gatherX: TREE_HEART.x,
      gatherY: TREE_HEART.y,
      gatherZ: TREE_HEART.z,
      gatherStrength: 0,
      targetGatherStrength: 0,
      trail: createGatherTrail(),
      trailHead: 0,
      dragging: false,
      hoverTree: false,
      pulse: 0,
      lastX: 0,
      lastY: 0,
    };
    for (const v of pointer.trail) {
      v.copy(TREE_HEART);
    }

    const onVisibility = () => {
      tabVisible = document.visibilityState === 'visible';
    };

    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      mounted = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
      unbindPointer?.();
      document.removeEventListener('visibilitychange', onVisibility);
      host.classList.remove('has-webgl');
      renderer?.dispose();
      if (renderer?.domElement?.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
      for (const item of disposables) {
        item.dispose?.();
      }
      scene?.traverse((obj) => {
        if (obj.geometry && obj.geometry !== MOTE_CORE_GEO && obj.geometry !== MOTE_HALO_GEO) {
          obj.geometry.dispose();
        }
      });
    };

    const boot = () => {
      if (!mounted || disposed) return;

      const width = Math.max(host.clientWidth, 2);
      const height = Math.max(host.clientHeight, 2);
      if (host.clientWidth < 2 || host.clientHeight < 2) {
        requestAnimationFrame(boot);
        return;
      }

      try {
        const reduced = prefersReducedMotion();

        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(SKY_HAZE, 0.00108);

        const camera = new THREE.PerspectiveCamera(32, width / height, 1, 2000);
        applyCameraPose(camera, pointer);

        renderer = new THREE.WebGLRenderer({
          antialias: window.devicePixelRatio < 2,
          alpha: true,
          powerPreference: 'high-performance',
        });
        if (!renderer.getContext()) {
          throw new Error('WebGL context unavailable');
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height, false);
        renderer.setClearColor(0x000000, 0);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.02;
        mount.appendChild(renderer.domElement);
        host.classList.add('has-webgl');

        if (!reduced) {
          unbindPointer = bindHeroInteraction(host, renderer.domElement, pointer, reduced);
        }

        scene.add(new THREE.AmbientLight(0xf2fbfb, 0.5));
        scene.add(new THREE.HemisphereLight(0xd7f1fa, 0x88bd95, 0.48));
        const sun = new THREE.DirectionalLight(0xfff1d6, 0.82);
        sun.position.set(180, 220, 140);
        scene.add(sun);
        const fill = new THREE.DirectionalLight(0xb8ded1, 0.34);
        fill.position.set(-60, 50, 100);
        scene.add(fill);
        const rim = new THREE.DirectionalLight(0xffffff, 0.32);
        rim.position.set(TREE_X + 100, 60, 80);
        scene.add(rim);

        const gradientMap = createToonGradient();
        disposables.push(gradientMap);
        const pool = createMaterialPool(gradientMap);
        disposables.push(...pool.list, pool.outline);

        const groundTexture = createGroundTexture();
        disposables.push(groundTexture);

        scene.add(buildGround(pool, groundTexture));

        const { group: floatingIslandGroup, islands: floatingIslands } = buildFloatingIslands(pool);
        scene.add(floatingIslandGroup);

        const claudeSource = buildClaudeSource(pool);
        scene.add(claudeSource);

        const { motes: orbitMotes } = buildTreeOrbitSystem(pool);
        for (const mote of orbitMotes) {
          scene.add(mote);
        }

        const { beacon, ring: gatherRing, core: gatherCore } = buildGatherBeacon(pool);
        scene.add(beacon);

        const { tree, rootRings, canopyPuffs } = buildKnowledgeTree(pool);
        scene.add(tree);

        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(claudeCodeLogo, (claudeTex) => {
          if (!mounted || disposed) return;
          disposables.push(claudeTex);
          addBillboard(claudeSource, claudeTex, 9, 9, 0, 1.5, 1);
        });

        const clock = new THREE.Clock();

        const resize = () => {
          if (!renderer || !mounted) return;
          const w = Math.max(host.clientWidth, 2);
          const h = Math.max(host.clientHeight, 2);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h, false);
        };

        ro = new ResizeObserver(resize);
        ro.observe(host);

        io = new IntersectionObserver(([entry]) => {
          inView = entry.isIntersecting;
        }, { threshold: 0.08 });
        io.observe(host);

        document.addEventListener('visibilitychange', onVisibility);

        const renderFrame = (t) => {
          if (!mounted || !renderer || !scene) return;

          try {
            pointer.yaw += (pointer.targetYaw - pointer.yaw) * 0.09;
            pointer.pitch += (pointer.targetPitch - pointer.pitch) * 0.09;

            pointer.gatherStrength += (pointer.targetGatherStrength - pointer.gatherStrength) * 0.09;
            if (pointer.mouseActive && pointer.gatherStrength > 0.02) {
              resolveMouseGatherPoint(camera, pointer, _gatherPoint);
              const gLerp = 0.16 + pointer.gatherStrength * 0.08;
              pointer.gatherX += (_gatherPoint.x - pointer.gatherX) * gLerp;
              pointer.gatherY += (_gatherPoint.y - pointer.gatherY) * gLerp;
              pointer.gatherZ += (_gatherPoint.z - pointer.gatherZ) * gLerp;
              _gatherPoint.set(pointer.gatherX, pointer.gatherY, pointer.gatherZ);
              pushGatherTrail(pointer, _gatherPoint);
            } else if (pointer.gatherStrength < 0.02) {
              pointer.gatherX += (TREE_HEART.x - pointer.gatherX) * 0.06;
              pointer.gatherY += (TREE_HEART.y - pointer.gatherY) * 0.06;
              pointer.gatherZ += (TREE_HEART.z - pointer.gatherZ) * 0.06;
            }
            _gatherPoint.set(pointer.gatherX, pointer.gatherY, pointer.gatherZ);

            if (pointer.pulse > 0) {
              pointer.pulse = Math.max(0, pointer.pulse - 0.04);
              for (const ring of rootRings) {
                ring.material.opacity = 0.06 + pointer.pulse * 0.14;
              }
            }

            const speedMul = 1
              + (pointer.hoverTree ? 0.28 : 0)
              + pointer.pulse * 0.55
              + pointer.gatherStrength * 0.42;

            const beaconStrength = pointer.gatherStrength;
            beacon.position.copy(_gatherPoint);
            beacon.position.y += 0.4;
            const pulse = 0.5 + Math.sin(t * 2.2) * 0.5;
            gatherRing.material.opacity = beaconStrength * (0.08 + pulse * 0.06);
            gatherCore.material.opacity = beaconStrength * (0.12 + pulse * 0.08);
            const beaconScale = 1 + beaconStrength * (0.35 + pulse * 0.15);
            gatherRing.scale.setScalar(beaconScale);
            gatherCore.scale.setScalar(beaconScale * 0.72);

            if (!reduced) {
              for (const island of floatingIslands) {
                const ud = island.userData;
                island.position.y = ud.baseY + Math.sin(t * ud.speed + ud.phase) * ud.drift;
                island.rotation.y = ud.baseRotationY + t * ud.spin;
                island.rotation.z = Math.sin(t * ud.speed * 0.65 + ud.phase) * 0.018;
              }
              for (const mote of orbitMotes) {
                const lag = mote.userData.trailLag ?? 0;
                sampleGatherTrail(pointer, lag, _pullDir);
                if (mote.userData.drift) {
                  updateDriftMote(mote, t, _pullDir, pointer.gatherStrength);
                } else {
                  updateTreeOrbitMote(mote, t, speedMul, _pullDir, pointer.gatherStrength);
                }
              }
              for (const puff of canopyPuffs) {
                const ud = puff.userData;
                if (ud.baseX == null) continue;
                const sway = ud.sway ?? 1;
                puff.position.x = ud.baseX + Math.sin(t * ud.speed + ud.phase) * 0.35 * sway;
                puff.position.y = ud.baseY + Math.sin(t * ud.speed * 0.85 + ud.phase) * 0.2 * sway;
                puff.position.z = ud.baseZ + Math.cos(t * ud.speed * 0.65 + ud.phase) * 0.28 * sway;
              }
            }

            applyCameraPose(camera, pointer);

            if (!reduced && pointer.hoverTree) {
              claudeSource.userData.glow.material.opacity = 0.14 + Math.sin(t * 1.4) * 0.05;
            } else {
              claudeSource.userData.glow.material.opacity = 0.14;
            }

            renderer.render(scene, camera);
          } catch (frameError) {
            console.error('[HeroDirectionAnimation] frame error:', frameError);
          }
        };

        renderFrame(0);

        if (!reduced) {
          const tick = () => {
            if (!mounted) return;
            raf = requestAnimationFrame(tick);
            if (!inView || !tabVisible) return;
            renderFrame(clock.getElapsedTime());
          };
          tick();
        }

        host.dataset.heroScene = 'ready';
      } catch (error) {
        console.error('[HeroDirectionAnimation] init failed:', error);
        host.dataset.heroScene = 'failed';
        cleanup();
      }
    };

    requestAnimationFrame(boot);

    return cleanup;
  }, []);

  return (
    <div
      className={`hero-ambient${className ? ` ${className}` : ''}`}
      ref={hostRef}
      aria-label={ariaLabel}
    >
      <div className="hero-ambient-canvas" ref={canvasMountRef} aria-hidden="true">
        <div className="hero-ambient-fallback">
          <span className="hero-fallback-island hero-fallback-island-one" />
          <span className="hero-fallback-island hero-fallback-island-two" />
          <span className="hero-fallback-island hero-fallback-island-three" />
          <div className="hero-fallback-ground" />
          <div className="hero-fallback-tree" aria-hidden="true">
            <span className="hero-fallback-trunk" />
            <span className="hero-fallback-crown hero-fallback-crown-one" />
            <span className="hero-fallback-crown hero-fallback-crown-two" />
            <span className="hero-fallback-crown hero-fallback-crown-three" />
            <span className="hero-fallback-crown hero-fallback-crown-four" />
          </div>
          <span className="hero-fallback-mote hero-fallback-mote-one" />
          <span className="hero-fallback-mote hero-fallback-mote-two" />
          <span className="hero-fallback-mote hero-fallback-mote-three" />
        </div>
      </div>
    </div>
  );
}
