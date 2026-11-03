import * as GFX from 'madness-engine/gfx';
import { createStage } from 'madness-engine/stage';
import { createView } from 'madness-engine/view';
import { createModel } from 'madness-engine/models/model';
import { createBakeLibrary } from 'madness-engine/models/bake';
import { bake as legacyBake } from 'madness-engine/models/legacy-bake';
import { floorTexture, wallTexture } from 'madness-engine/textures/venue';
import { paintRoom } from 'madness-engine/textures/rooms/town';
import { paintSky } from 'madness-engine/textures/skies/haze';
import { screenMovementToWorld, startsCameraDrag, holdsCameraDrag, endsCameraDrag } from './controls.js';
import { CAT_ROSTER, STAFF, RESIDENTS, RESIDENT_BY_ID, activeFrameDelta } from './sim.js';
import {
  SHELL, FRONT_DOOR, REAR_DOOR, BACKROOM, SIDEWALK, LEVELS, GONDOLA, COOLER_LEVELS, COOLER_HEIGHT, BAKERY_TOP, COUNTER,
  BACKBAR, SLOTS, DOOR_IN, SIDEWALK_SPAWN, SIDEWALK_EXITS, CHECKOUT, LOU_HOME, BOB_HOME, WAITER_HOME, KITCHEN_PASS, MANAGER_HOME, PLAYER_HOME,
  GONDOLA_2_BOARDS, BIN_SIZE, PIECES, PIECE_BY_ID, pieceOfProduct, isStanding, placementOf, setLayout, footprint, snapPlacement, placementProblem,
  CAT_PATROLS, navBlocked, nearestWalkable, findWalkPath, planWalkRoute, routeLength, pointOnRoute, CAFE_SEATS, CAFE_SERVICE_STOPS,
} from './layout.js';
import { wallOpacity, easeOpacity, WALL_MODES } from './walls.js';
import { CAST, DETAIL, loadingJobs, backgroundJobs, FIRST_WAVE } from './cast.js';
import { STREETSCAPE, STREET_MODELS } from './streetscape.js';
import { buildCafeFurniture, buildCafeKitchen } from './cafe.js';
import { createBreakfastPlate } from './cafe-food.js';

const PLAYER_SPEED = 2.25;
const HUMAN_HEIGHT = 1.42;
const CAT_HEIGHT = 0.31;
const BRICK_TILE = 2.25;                       // world units a brick texture tile covers
const STORE_CENTER = [0, 0];

function normalizeActorHeight(model, targetHeight) {
  const geometry = model.mesh.geometry;
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  const meshScaleY = model.mesh.scale.y || 1;
  const currentHeight = Math.max(0.001, (bounds.max.y - bounds.min.y) * meshScaleY);
  const fit = targetHeight / currentHeight;
  model.group.scale.setScalar(fit);
  return -bounds.min.y * meshScaleY * fit;
}

function faceAlong(group, from, to) {
  const dx = to[0] - from[0], dz = to[2] - from[2];
  if (Math.hypot(dx, dz) > 0.02) group.rotation.y = Math.atan2(dx, dz);
}

function makeSignTexture(text, { background = '#14252a', foreground = '#f4e8ce', accent = '#df674b', width = 512, height = 128, fontSize = 60 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = accent; ctx.fillRect(0, height - 8, width, 8);
  ctx.font = `800 ${fontSize}px 'DM Sans', sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = foreground;
  ctx.fillText(text.toUpperCase(), width / 2, height / 2 - 2, width - 32);
  const texture = new GFX.CanvasTexture(canvas);
  texture.colorSpace = GFX.SRGBColorSpace;
  return texture;
}

const labelTexture = (text) => makeSignTexture(text, { background: '#f2e8cf', foreground: '#273238', accent: '#d36c50', width: 256, height: 80, fontSize: 30 });

export async function createVentureCafeWorld(host, onProgress = () => {}) { // eslint-disable-line no-param-reassign
  const report = onProgress;
  let shown = 0;
  onProgress = (label, percent) => report(label, (shown = Math.max(shown, percent)));   // the bar only ever moves forward
  onProgress('Opening the shop floor', 3);
  const params = new URLSearchParams(window.location.search);

  // ——— models are sculpted in workers while the scene is built ———
  const spawn = () => new Worker(new URL('./bake.worker.js', import.meta.url), { type: 'module' });
  const library = createBakeLibrary({ sculpted: CAST, spawn, jobs: loadingJobs, label: 'venture-cafe' });
  const jobs = loadingJobs();
  let bakedCount = 0;
  const waits = jobs.map(([name, detail]) => library.ready(name, detail).then(() => {
    bakedCount += 1;
    onProgress(`Sculpting the neighborhood · ${bakedCount} of ${jobs.length}`, 8 + (bakedCount / jobs.length) * 60);
  }));
  library.preload(jobs);

  const view = createView({ yaw: Number(params.get('yaw') ?? -0.55), pitch: Number(params.get('pitch') ?? 0.72), zoom: 1.0 });
  const stage = await createStage(host, {
    label: 'venture-cafe',
    lens: { distance: 27, fov: 37 },
    view,
    sky: paintSky(),
    room: paintRoom(),
    lights: {
      hemisphere: { sky: '#e6e7de', ground: '#303039', intensity: 1.1 },
      key: { color: '#ffe1b5', intensity: 2.0 },
      fill: { color: '#c5dbe4', intensity: 0.42, offset: [6, 4, 5] },
    },
    shadows: true,
    shadowSize: 1536,
    pixelRatio: Number(params.get('pr') ?? Math.min(window.devicePixelRatio || 1, 1.75)),
  });
  const { scene } = stage;
  onProgress('Building the neighborhood store', 10);

  // ——— materials and building helpers ———
  const std = (color, extra = {}) => new GFX.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
  const mats = {
    dark: std('#222d31', { roughness: 0.74 }),
    wood: std('#9b6840'),
    woodLight: std('#c18b55', { roughness: 0.78 }),
    woodDark: std('#6a4630'),
    trim: std('#d5c5a7', { roughness: 0.7 }),
    metal: std('#67777c', { metalness: 0.64, roughness: 0.36 }),
    steelDark: std('#303d43', { metalness: 0.52, roughness: 0.42 }),
    glass: new GFX.MeshPhysicalMaterial({ color: '#b9d9d8', transparent: true, opacity: 0.2, roughness: 0.1, metalness: 0.1 }),
    chalk: std('#e7dfc8', { roughness: 0.9 }),
    leaf: std('#648c48', { roughness: 0.84 }),
    concrete: std('#8f948f', { roughness: 0.95 }),
    sidewalk: std('#a9a79f', { roughness: 0.95 }),
    asphalt: std('#2d3135', { roughness: 0.97 }),
    paint: std('#e8e4d6', { roughness: 0.8 }),
    kraft: std('#b78a56', { roughness: 0.95 }),
    bulb: std('#ffd99b', { emissive: '#ffb95e', emissiveIntensity: 1.25, roughness: 0.25 }),
    led: std('#dff4ff', { emissive: '#b8e7f0', emissiveIntensity: 1.6, roughness: 0.3 }),
    rubber: std('#26292b', { roughness: 0.95 }),
  };

  function box(parent, x, y, z, w, h, d, material, { castShadow = true, receiveShadow = true, rotation = null } = {}) {
    const mesh = new GFX.Mesh(new GFX.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    if (rotation) mesh.rotation.set(...rotation);
    parent.add(mesh);
    return mesh;
  }
  function cylinder(parent, x, y, z, radiusTop, radiusBottom, height, material, segments = 16) {
    const mesh = new GFX.Mesh(new GFX.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
    return mesh;
  }
  function sphere(parent, x, y, z, radius, material, scale = [1, 1, 1]) {
    const mesh = new GFX.Mesh(new GFX.SphereGeometry(radius, 16, 12), material);
    mesh.position.set(x, y, z); mesh.scale.set(...scale); mesh.castShadow = true; parent.add(mesh);
    return mesh;
  }
  function signPlane(parent, text, x, y, z, w, h, style, { rotationY = 0, transparent = false, singleSided = false } = {}) {
    const material = new GFX.MeshBasicMaterial({ map: makeSignTexture(text, style), side: singleSided ? GFX.FrontSide : GFX.DoubleSide, transparent });
    const mesh = new GFX.Mesh(new GFX.PlaneGeometry(w, h), material);
    mesh.position.set(x, y, z); mesh.rotation.y = rotationY;
    parent.add(mesh);
    return mesh;
  }

  // Brick that keeps its scale and its alignment on any wall: the UVs follow world position.
  const wallTex = wallTexture(GFX, 'brick');
  const wallMap = new GFX.CanvasTexture(wallTex.map.image);
  wallMap.colorSpace = GFX.SRGBColorSpace; wallMap.wrapS = wallMap.wrapT = GFX.RepeatWrapping;
  const wallBump = new GFX.CanvasTexture(wallTex.bump.image);
  wallBump.wrapS = wallBump.wrapT = GFX.RepeatWrapping;
  function alignBrickUV(mesh) {
    const g = mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
    if (!uv || !pos || !nor) return;
    const { x: ox, y: oy, z: oz } = mesh.position;
    for (let i = 0; i < uv.count; i++) {
      const x = pos.getX(i) + ox, y = pos.getY(i) + oy, z = pos.getZ(i) + oz;
      // The pattern follows the world, not the box: along the wall and up it (or across a top face), so every wall,
      // partition and base course shares one pattern and their courses and joints line up.
      if (Math.abs(nor.getY(i)) > 0.5) uv.setXY(i, x / BRICK_TILE, z / BRICK_TILE);
      else if (Math.abs(nor.getX(i)) > 0.5) uv.setXY(i, z / BRICK_TILE, y / BRICK_TILE);
      else uv.setXY(i, x / BRICK_TILE, y / BRICK_TILE);
    }
    uv.needsUpdate = true;
  }

  /**
   * A wall that can fade: a group with materials of its own, so one wall can go to a
   * ghost while the next stays solid. `normal` is its outward direction; `both` is a
   * partition, which hides the shop from either side.
   */
  const wallGroups = [];
  function wall(name, { normal, both = false }) {
    const group = new GFX.Group();
    scene.add(group);
    const w = { name, normal, both, group, opacity: 1, applied: 1, mats: new Map(), meshes: [] };
    const material = (key, make) => {
      if (!w.mats.has(key)) { const m = make(); m.transparent = true; m.baseOpacity = m.opacity ?? 1; w.mats.set(key, m); }
      return w.mats.get(key);
    };
    w.brick = (x, y, z, bw, bh, bd, tint = '#a8a092') => {
      const m = material(`brick${tint}`, () => new GFX.MeshStandardMaterial({ color: tint, map: wallMap, bumpMap: wallBump, bumpScale: 0.09, roughness: 0.9 }));
      const mesh = new GFX.Mesh(new GFX.BoxGeometry(bw, bh, bd), m);
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
      alignBrickUV(mesh);
      group.add(mesh); w.meshes.push(mesh);
      return mesh;
    };
    w.box = (x, y, z, bw, bh, bd, key, make, opts = {}) => {
      const mesh = box(group, x, y, z, bw, bh, bd, material(key, make), opts);
      w.meshes.push(mesh);
      return mesh;
    };
    w.glass = (x, y, z, bw, bh, bd) => w.box(x, y, z, bw, bh, bd, 'glass', () => new GFX.MeshPhysicalMaterial({ color: '#9fd0dc', transparent: true, opacity: 0.22, roughness: 0.08, metalness: 0.1 }), { castShadow: false });
    w.frame = (x, y, z, bw, bh, bd, color = '#2b3538') => w.box(x, y, z, bw, bh, bd, `frame${color}`, () => std(color, { roughness: 0.5, metalness: 0.3 }));
    w.wood = (x, y, z, bw, bh, bd) => w.box(x, y, z, bw, bh, bd, 'wood', () => std('#c18b55', { roughness: 0.78 }));
    w.plane = (text, x, y, z, pw, ph, style, rotationY = 0) => {
      const m = material(`sign${text}`, () => new GFX.MeshBasicMaterial({ map: makeSignTexture(text, style), side: GFX.DoubleSide }));
      const mesh = new GFX.Mesh(new GFX.PlaneGeometry(pw, ph), m);
      mesh.position.set(x, y, z); mesh.rotation.y = rotationY;
      group.add(mesh); w.meshes.push(mesh);
      return mesh;
    };
    w.material = material;
    wallGroups.push(w);
    return w;
  }

  /** A window set into a wall's face: light glass inside a frame of bars and a mullion. `axis` is the way the wall runs. */
  function fakeWindow(wl, { cx, cy, cz, w: ww, h: hh, axis }) {
    const bar = 0.07, depth = 0.07;
    const along = (len, thick) => (axis === 'x' ? [len, thick, depth] : [depth, thick, len]);
    const at = (off) => (axis === 'x' ? [cx + off, cz] : [cx, cz + off]);
    wl.box(cx, cy, cz, ...(axis === 'x' ? [ww, hh, 0.04] : [0.04, hh, ww]), 'window-glass', () => new GFX.MeshPhysicalMaterial({ color: '#9fd0e0', transparent: true, opacity: 0.6, roughness: 0.1 }), { castShadow: false });
    for (const sy of [-1, 1]) { const [x, z] = at(0); wl.frame(x, cy + sy * hh / 2, z, ...along(ww + bar, bar)); }
    for (const sx of [-1, 1]) { const [x, z] = at(sx * ww / 2); wl.frame(x, cy, z, ...(axis === 'x' ? [bar, hh, depth] : [depth, hh, bar])); }
    const [mx, mz] = at(0);
    wl.frame(mx, cy, mz, ...(axis === 'x' ? [0.04, hh, depth] : [depth, hh, 0.04]));
  }

  // ——— the ground: street, sidewalk, alley ———
  box(scene, 0, -0.55, 0, 140, 0.4, 140, mats.asphalt, { castShadow: false });
  const sidewalkFar = SIDEWALK.maxZ + 0.15;
  box(scene, 0, -0.15, (SIDEWALK.minZ + sidewalkFar) / 2, 60, 0.3, sidewalkFar - SIDEWALK.minZ, mats.sidewalk, { castShadow: false });   // the sidewalk, from the wall to the curb
  box(scene, 0, -0.13, 10.45, 60, 0.46, 0.3, mats.concrete, { castShadow: false });                                    // the curb, down to the road
  box(scene, 0, -0.15, -11.15, 60, 0.3, 8, mats.sidewalk, { castShadow: false });                                       // the alley behind
  // A threshold in each doorway, a hair proud of the floor and the pavement it joins, so they never share a plane.
  box(scene, 2.4, -0.094, 7, 1.5, 0.2, 0.3, mats.concrete, { castShadow: false });
  box(scene, -5.7, -0.094, -7, 1.3, 0.2, 0.3, mats.concrete, { castShadow: false });
  for (let x = -27; x <= 27; x += 4.5) box(scene, x, -0.345, 14, 2.2, 0.02, 0.2, mats.paint, { castShadow: false, receiveShadow: false });

  // ——— the floor ———
  const floorTex = floorTexture(GFX, 'checker');
  const floorMap = new GFX.CanvasTexture(floorTex.map.image);
  floorMap.colorSpace = GFX.SRGBColorSpace; floorMap.wrapS = floorMap.wrapT = GFX.RepeatWrapping; floorMap.repeat.set(9, 7);
  const floorBump = new GFX.CanvasTexture(floorTex.bump.image);
  floorBump.wrapS = floorBump.wrapT = GFX.RepeatWrapping; floorBump.repeat.set(9, 7);
  box(scene, 0, -0.15, 0, 18.2, 0.3, 14.2, new GFX.MeshStandardMaterial({ color: '#b8b0a0', map: floorMap, bumpMap: floorBump, bumpScale: 0.08, roughness: 0.82 }), { castShadow: false });
  const br = BACKROOM;
  box(scene, (br.minX + br.maxX) / 2, 0.006, (br.minZ + br.maxZ) / 2, br.maxX - br.minX, 0.014, br.maxZ - br.minZ, mats.concrete, { castShadow: false });   // the backroom's concrete
  box(scene, FRONT_DOOR.x, 0.01, 6.2, 1.6, 0.02, 0.9, mats.rubber, { castShadow: false });                                                                 // the doormat
  box(scene, REAR_DOOR.x, 0.01, -6.3, 1.4, 0.02, 0.8, mats.rubber, { castShadow: false });

  // ——— the shell: four outer walls with a street door, big windows, a rear door ———
  const H = SHELL.height, W = SHELL.maxX, Z = SHELL.maxZ, T = SHELL.wall;
  const dl = FRONT_DOOR.x - FRONT_DOOR.width / 2, dr = FRONT_DOOR.x + FRONT_DOOR.width / 2;

  // Always visible, so the footprint reads even when the walls are ghosts: a low brick plinth round the building.
  const plinth = new GFX.Group(); scene.add(plinth);
  const plinthMat = new GFX.MeshStandardMaterial({ color: '#8f8576', map: wallMap, bumpMap: wallBump, bumpScale: 0.09, roughness: 0.9 });
  // The plinth stands 3 cm proud of the wall on each side, so its faces are never in the wall's plane.
  const plinthBox = (x, z, bw, bd) => { const mesh = new GFX.Mesh(new GFX.BoxGeometry(bw, 0.34, bd), plinthMat); mesh.position.set(x, 0.17, z); alignBrickUV(mesh); mesh.castShadow = true; mesh.receiveShadow = true; plinth.add(mesh); };
  const PL = 0.06;
  // Front and back plinths run the full width; the side ones run only between them, so no two share a face at a corner.
  const E = W + T / 2 + PL / 2;                                  // the plinth's outer edge
  plinthBox(0, -(Z + T / 2 - 0.15), E * 2, T + PL);
  plinthBox(-(W + T / 2 - 0.15), 0, T + PL, Z * 2 - T - PL);
  plinthBox(W + T / 2 - 0.15, 0, T + PL, Z * 2 - T - PL);
  plinthBox((-E + dl) / 2, Z + T / 2 - 0.15, dl + E, T + PL);
  plinthBox((dr + E) / 2, Z + T / 2 - 0.15, E - dr, T + PL);

  // Front: a storefront. Brick bulkhead, piers, a header with the sign, glass between, a glass door.
  const front = wall('front', { normal: [0, 1] });
  const fz = Z + T / 2 - 0.15;
  const windowBottom = 0.95, windowTop = 3.15;
  const spanL = [[-W - T / 2, -8.4], [-4.3, -3.9], [1.2, dl]];            // piers either side of the left windows
  const panes = [[-8.4, -4.3], [-3.9, 1.2], [3.6, 8.4]];              // the three display windows
  front.brick((-W - T / 2 + dl) / 2, windowBottom / 2, fz, dl + W + T / 2, windowBottom, T);          // left bulkhead
  front.brick((dr + W + T / 2) / 2, windowBottom / 2, fz, W + T / 2 - dr, windowBottom, T);            // right bulkhead
  for (const [a, b] of spanL) front.brick((a + b) / 2, (windowBottom + windowTop) / 2, fz, b - a, windowTop - windowBottom, T);
  front.brick((dr + 3.6) / 2, (windowBottom + windowTop) / 2, fz, 3.6 - dr, windowTop - windowBottom, T);   // pier by the door
  front.brick((8.4 + W + T / 2) / 2, (windowBottom + windowTop) / 2, fz, W + T / 2 - 8.4, windowTop - windowBottom, T);
  front.brick(0, (windowTop + H) / 2, fz, W * 2 + T, H - windowTop, T);                   // the header, all along
  for (const [a, b] of panes) {
    const cx = (a + b) / 2, bw = b - a, ch = (windowBottom + windowTop) / 2;
    front.glass(cx, ch, fz, bw, windowTop - windowBottom, 0.05);
    front.frame(cx, windowBottom + 0.03, fz + 0.04, bw + 0.1, 0.08, 0.14);
    front.frame(cx, windowTop - 0.03, fz + 0.04, bw + 0.1, 0.08, 0.14);
    front.frame(a, ch, fz + 0.04, 0.07, windowTop - windowBottom, 0.14);
    front.frame(b, ch, fz + 0.04, 0.07, windowTop - windowBottom, 0.14);
    front.frame(cx, ch, fz + 0.04, 0.05, windowTop - windowBottom, 0.1);
  }
  // The doorway: a frame, a glass transom, and the door leaf, hinged at its right edge so it swings out.
  front.frame(dl, 1.6, fz + 0.03, 0.1, 3.2, 0.2);
  front.frame(dr, 1.6, fz + 0.03, 0.1, 3.2, 0.2);
  front.frame(FRONT_DOOR.x, 2.45, fz + 0.03, FRONT_DOOR.width + 0.1, 0.1, 0.2);
  front.glass(FRONT_DOOR.x, 2.8, fz, FRONT_DOOR.width, 0.7, 0.05);
  const doorLeaf = new GFX.Group();
  doorLeaf.position.set(dr - 0.04, 0, fz + 0.04);
  front.group.add(doorLeaf);
  const leafW = FRONT_DOOR.width - 0.1;
  const leafPart = (x, y, bw, bh, bd, key, make, opts) => { const mesh = box(doorLeaf, x, y, 0, bw, bh, bd, front.material(key, make), opts); front.meshes.push(mesh); return mesh; };
  leafPart(-leafW / 2, 1.2, leafW - 0.2, 2.2, 0.04, 'glass', () => new GFX.MeshPhysicalMaterial({ color: '#9fd0dc', transparent: true, opacity: 0.22, roughness: 0.08 }), { castShadow: false });
  leafPart(-0.04, 1.2, 0.1, 2.4, 0.07, 'frame#2b3538', () => std('#2b3538', { roughness: 0.5, metalness: 0.3 }));
  leafPart(-leafW + 0.04, 1.2, 0.1, 2.4, 0.07, 'frame#2b3538', () => std('#2b3538'));
  leafPart(-leafW / 2, 2.38, leafW, 0.1, 0.07, 'frame#2b3538', () => std('#2b3538'));
  leafPart(-leafW / 2, 0.14, leafW, 0.28, 0.07, 'frame#2b3538', () => std('#2b3538'));
  leafPart(-leafW + 0.22, 1.05, 0.05, 0.5, 0.1, 'metal', () => std('#c9ced1', { metalness: 0.8, roughness: 0.3 }));       // the push bar
  // The awning over the windows, and the sign above it.
  for (let i = 0; i < 18; i++) {
    const stripe = front.box(-W + 0.5 + i * ((W * 2 - 1) / 17), 3.55, Z + 0.95, (W * 2 - 1) / 17 + 0.003, 0.06, 2.1, i % 2 ? 'awnA' : 'awnB', () => std(i % 2 ? '#e9e3d0' : '#2f6b57', { roughness: 0.9 }), { rotation: [0.36, 0, 0] });
    stripe.castShadow = true;
  }
  front.plane('VENTURE CAFE', 0, 4.0, Z + 0.17, 7.4, 0.8, { background: '#1d2c2f', foreground: '#f6e8ca', accent: '#c2a26a', fontSize: 58, width: 1024, height: 112 });

  // Back: solid brick with the delivery door and two high windows.
  const back = wall('back', { normal: [0, -1] });
  const bz = -(Z + T / 2 - 0.15);
  const rl = REAR_DOOR.x - REAR_DOOR.width / 2, rr = REAR_DOOR.x + REAR_DOOR.width / 2;
  back.brick((-W - T / 2 + rl) / 2, H / 2, bz, rl + W + T / 2, H, T);
  back.brick((rr + W + T / 2) / 2, H / 2, bz, W + T / 2 - rr, H, T);
  back.brick(REAR_DOOR.x, (2.4 + H) / 2, bz, REAR_DOOR.width, H - 2.4, T);
  back.box(REAR_DOOR.x, 1.2, bz + 0.05, REAR_DOOR.width - 0.06, 2.4, 0.08, 'rear', () => std('#44545a', { metalness: 0.6, roughness: 0.45 }));
  back.box(REAR_DOOR.x + 0.45, 1.1, bz + 0.12, 0.08, 0.3, 0.06, 'handle', () => std('#c9ced1', { metalness: 0.8, roughness: 0.3 }));
  for (const x of [1.5, 6.2]) fakeWindow(back, { cx: x, cy: 3.1, cz: bz + 0.18, w: 1.8, h: 0.9, axis: 'x' });
  back.plane('RECEIVING · DELIVERIES', REAR_DOOR.x, 3.2, bz - 0.17, 2.6, 0.4, { background: '#3d5148', foreground: '#f4e9d1', accent: '#d6b578', fontSize: 40, width: 640, height: 100 }, Math.PI);

  // Left and right: brick with tall windows.
  const left = wall('left', { normal: [-1, 0] });
  const right = wall('right', { normal: [1, 0] });
  for (const [w, sx] of [[left, -1], [right, 1]]) {
    const wx = sx * (W + T / 2 - 0.15);
    w.brick(wx, H / 2, 0, T, H, Z * 2 - T);                          // between the front and back walls, not overlapping them
    const windows = sx < 0 ? [1.4, 4.4] : [-3.4, -0.6];
    for (const z of windows) fakeWindow(w, { cx: wx - sx * 0.17, cy: 2.2, cz: z, w: 1.7, h: 1.5, axis: 'z' });
  }
  right.plane('NEXT PLEASE', W - 0.2, 3.3, COUNTER.z, 2.6, 0.5, { background: '#354b47', foreground: '#f0e7cf', accent: '#d9a55f', fontSize: 52, width: 768, height: 104 }, -Math.PI / 2);

  // The backroom's own walls, shorter than the shell: they hide the room from either side, so they fade from both.
  const partitionH = 3.0;
  const partNS = wall('backroom-east', { normal: [1, 0], both: true });
  partNS.brick(br.maxX, partitionH / 2, (br.minZ + br.maxZ - T / 2) / 2, T, partitionH, br.maxZ - T / 2 - br.minZ, '#b9b2a2');   // from the back wall to the south partition's face
  partNS.plane('STOCKROOM', br.maxX + 0.17, 2.3, -4.3, 1.8, 0.36, { background: '#3d5148', foreground: '#f4e9d1', accent: '#d6b578', fontSize: 40, width: 576, height: 92 }, Math.PI / 2);
  const partEW = wall('backroom-south', { normal: [0, 1], both: true });
  const gapL = br.doorX - br.doorWidth / 2, gapR = br.doorX + br.doorWidth / 2;
  partEW.brick((br.minX - T + gapL) / 2, partitionH / 2, br.maxZ, gapL - br.minX + T, partitionH, T, '#b9b2a2');
  partEW.brick((gapR + br.maxX + T / 2) / 2, partitionH / 2, br.maxZ, br.maxX + T / 2 - gapR, partitionH, T, '#b9b2a2');
  partEW.brick(br.doorX, (2.3 + partitionH) / 2, br.maxZ, br.doorWidth, partitionH - 2.3, T, '#b9b2a2');
  partEW.frame(gapL, 1.15, br.maxZ, 0.08, 2.3, 0.4);
  partEW.frame(gapR, 1.15, br.maxZ, 0.08, 2.3, 0.4);

  // The buildings either side.
  const leftNeighbor = wall('neighbor-left', { normal: [-1, 0] });
  const rightNeighbor = wall('neighbor-right', { normal: [1, 0] });
  for (const [w, sx, tint] of [[leftNeighbor, -1, '#8a7a72'], [rightNeighbor, 1, '#9a8f7e']]) {
    const nx = sx * (W + T + 4.2);
    w.brick(nx, 3.4, 0, 8.4, 6.8, Z * 2 + 0.3, tint);
    for (const dx of [-2.6, 0, 2.6]) for (const y of [2.4, 4.9]) fakeWindow(w, { cx: nx + dx, cy: y, cz: Z + 0.18, w: 1.3, h: 1.3, axis: 'x' });
  }

  // ——— lights ———
  for (const [x, z] of [[-4, 3], [3, 3], [-1.6, -3.2], [4, -3.5]]) {
    const light = new GFX.PointLight('#ffd5a0', 12, 9, 1.5);
    light.position.set(x, 3.4, z); scene.add(light);
  }
  { const light = new GFX.PointLight('#ffe6b8', 8, 6, 1.6); light.position.set(-6.7, 2.6, -4.5); scene.add(light); }

  // ——— the street out front and the alley behind: the engine's own street furniture ———
  const streetBakes = new Map();
  for (const placement of STREETSCAPE) {
    if (!streetBakes.has(placement.model)) streetBakes.set(placement.model, legacyBake(GFX, STREET_MODELS[placement.model]));
    const { geometry, materials } = streetBakes.get(placement.model);
    const mesh = new GFX.Mesh(geometry, materials);
    mesh.position.set(placement.x, 0, placement.z);
    mesh.rotation.y = placement.yaw ?? 0;
    mesh.scale.setScalar(placement.scale ?? 1);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // ——— cafe fixtures ———
  onProgress('Setting up cafe furniture and prep stations', 70);
  // Everything that stands on the floor and can be moved (layout.js PIECES): each is built in its own frame, facing +z, and
  // stood where the layout says. The ones that are bought stay unseen until they are.
  const pieceViews = new Map();
  const pieceOfGroup = new Map();
  const fixtureViews = new Map();
  const forFixture = (id, object) => { object.visible = false; if (!fixtureViews.has(id)) fixtureViews.set(id, []); fixtureViews.get(id).push(object); return object; };
  const signStyle = { background: '#33464c', foreground: '#f4e9d1', accent: '#d16f53', fontSize: 34, width: 768, height: 96 };
  const coolerStyle = { background: '#38545a', foreground: '#eef3e5', accent: '#b3d9d2', fontSize: 38, width: 768, height: 80 };
  function buildGondola(group, piece) {
    const { w: length, d: depth } = piece, height = GONDOLA.height;
    box(group, 0, 0.16, 0, length + 0.06, 0.22, depth + 0.1, mats.dark);
    for (const sx of [-1, 1]) box(group, sx * (length / 2 - 0.05), height / 2, 0, 0.1, height, depth, mats.metal);
    box(group, 0, height / 2, 0, length - 0.2, height - 0.1, 0.08, mats.steelDark);
    box(group, 0, height + 0.04, 0, length + 0.1, 0.1, depth + 0.1, mats.dark);
    const faces = piece.id === 'pantry' ? ['PANTRY · RICE · PASTA · CEREAL', 'BEANS · COFFEE · FLOUR'] : ['SNACKS · BAKING · SPREADS', 'CHIPS · COOKIES · CANDY'];
    for (const s of [-1, 1]) signPlane(group, s > 0 ? faces[0] : faces[1], 0, height + 0.38, s * 0.56, Math.min(3.4, length - 0.5), 0.46, signStyle, { rotationY: s > 0 ? 0 : Math.PI, singleSided: true });
    // The boards: all of them on the pantry gondola, each of the second one's when it is bought.
    for (const [level, y] of LEVELS.entries()) for (const face of [1, -1]) {
      const fixture = Object.entries(GONDOLA_2_BOARDS).find(([, [f, l]]) => f === face && l === level)?.[0];
      const board = piece.id === 'pantry' ? group : forFixture(fixture, new GFX.Group());
      if (board !== group) group.add(board);
      box(board, 0, y - 0.03, face * 0.28, length - 0.12, 0.05, 0.52, mats.woodLight);
    }
  }
  function buildBin(group) {
    box(group, 0, 0.18, 0, BIN_SIZE, 0.36, BIN_SIZE, mats.wood);
    box(group, 0, 0.42, 0.62, 1.34, 0.3, 0.08, mats.woodLight);                    // the low lip on the aisle side
    box(group, 0, 0.55, -0.61, 1.34, 0.9, 0.1, mats.woodLight);                    // the tall back
    box(group, 0, 0.4, -0.04, 1.14, 0.04, 1.12, mats.woodDark);
    // A sign on the tall back, so it goes where the bin goes.
    signPlane(group, 'FRESH PRODUCE', 0, 0.86, -0.555, 1.0, 0.2, { background: '#35533c', foreground: '#f6edcf', accent: '#c8d19a', fontSize: 44, width: 768, height: 104 }, { singleSided: true });
  }
  function buildTable(group, piece) {
    box(group, 0, BAKERY_TOP / 2, 0, piece.w, BAKERY_TOP - 0.1, piece.d, mats.wood);
    box(group, 0, BAKERY_TOP - 0.05, 0, piece.w + 0.1, 0.1, piece.d + 0.1, mats.woodLight);
    signPlane(group, 'BAKERY', 0, BAKERY_TOP + 0.42, -0.3, 1.3, 0.36, { background: '#875a38', foreground: '#fff0d2', accent: '#e1b276', fontSize: 52, width: 512, height: 96 });
    box(group, 0, BAKERY_TOP + 0.18, -0.3, 0.05, 0.4, 0.05, mats.dark);
  }
  function buildCooler(group, piece) {
    const { w: cw, d: cd } = piece, ch = COOLER_HEIGHT;
    // The compressor plinth is set back from the glass, and the back panel stands a centimeter off the wall, so no two faces share a plane.
    box(group, 0, 0.15, -0.025, cw + 0.06, 0.3, cd - 0.05, mats.steelDark);
    box(group, 0, ch / 2 + 0.15, -cd / 2 + 0.05, cw, ch, 0.08, std('#cfd8d8', { roughness: 0.5 }));
    box(group, 0, ch + 0.2, 0, cw + 0.1, 0.16, cd + 0.06, mats.steelDark);          // the canopy
    box(group, 0, ch + 0.05, cd / 2 - 0.06, cw, 0.05, 0.05, mats.led, { castShadow: false });
    const posts = Math.max(2, Math.round(cw / 1.4) + 1);
    for (let i = 0; i < posts; i++) box(group, -cw / 2 + (cw * i) / (posts - 1), ch / 2 + 0.15, cd / 2 - 0.02, 0.08, ch, 0.1, mats.metal);
    for (const level of COOLER_LEVELS) box(group, 0, level - 0.03, 0, cw - 0.06, 0.05, 0.84, mats.metal);
    box(group, 0, (0.3 + ch + 0.1) / 2, cd / 2 - 0.02, cw - 0.04, ch - 0.2, 0.04, mats.glass, { castShadow: false });
    signPlane(group, piece.label, 0, ch + 0.2, cd / 2 + 0.04, Math.min(3, cw - 0.3), 0.3, coolerStyle);
  }
  function buildPieces() {
    // Retail shelf fixtures have no place in the dining room or cafe kitchen.
    // Keep empty keyed groups so old saves/layout references migrate safely, but do not render gondolas or display bins.
    for (const piece of PIECES) {
      const group = new GFX.Group();
      group.visible = false;
      scene.add(group);
      pieceViews.set(piece.id, group);
      pieceOfGroup.set(group, piece.id);
    }
  }

  function checkout() {
    const { x, z, w, d, top } = COUNTER;
    box(scene, x, top / 2 - 0.05, z, w, top - 0.1, d, mats.wood);
    box(scene, x, top - 0.02, z, w + 0.14, 0.1, d + 0.14, mats.dark);
    box(scene, x - 0.3, top + 0.035, z, 0.16, 0.04, d - 0.3, mats.rubber);
    box(scene, x + 0.2, top + 0.035, z, 0.4, 0.02, d - 0.2, mats.trim);
    box(scene, x - w / 2 - 0.04, top / 2 - 0.05, z, 0.06, top - 0.3, d - 0.2, mats.woodDark);

    // A small cafe register. Remove the inherited grocery bag stand and candy rack.
    box(scene, x + 2.8, top + 0.13, z + 0.08, 0.42, 0.2, 0.34, mats.steelDark);
    box(scene, x + 2.8, top + 0.32, z + 0.08, 0.38, 0.2, 0.05, mats.dark);
    box(scene, x + 2.8, top + 0.33, z + 0.05, 0.31, 0.14, 0.018, mats.led, { castShadow: false });

    // The backbar uses coffee tins and cups, not bright retail cartons.
    const bb = BACKBAR;
    box(scene, bb.x, 1.1, bb.z, 0.12, 2.2, bb.d, mats.woodDark);
    for (const y of [0.5, 1.1, 1.7]) {
      box(scene, bb.x - 0.18, y, bb.z, 0.34, 0.05, bb.d - 0.1, mats.woodLight);
      for (const offset of [-2.2, -0.8, 0.7, 2.1]) {
        cylinder(scene, bb.x - 0.18 + offset, y + 0.14, bb.z, 0.07, 0.07, 0.22,
          std('#e5dcc8', { roughness: 0.5 }), 18);
      }
    }
  }
  function backroom() {
    buildCafeKitchen(GFX, scene, mats);
  }
  buildPieces();
  checkout();
  backroom();
  buildCafeFurniture(GFX, scene);

  // The models were being sculpted in workers all this while: wait for the first wave before standing any of them up,
  // so nothing is baked on the page's own thread. (No workers, or a slow bake: it falls back to baking here.)
  onProgress('Sculpting the neighborhood', 72);
  if (typeof Worker !== 'undefined') await Promise.race([Promise.all(waits), new Promise((resolve) => setTimeout(resolve, 90000))]);

  // The cafe does not instantiate grocery display props. Recipe ingredients are tracked in the kitchen and dry-store UI.
  onProgress('Preparing kitchen inventory', 80);
  const displayGroups = new Map();

  // The former stockroom carton stack is removed; the cafe kitchen now has a prep station and a tidy dry store.

  // ——— people ———
  onProgress('Bringing in the staff and the venture-cafe cats', 86);
  const lou = createModel(GFX, CAST['staff:lou'], { detail: DETAIL.staff });
  const louFloor = normalizeActorHeight(lou, HUMAN_HEIGHT);
  const louHome = [LOU_HOME[0], louFloor, LOU_HOME[2]];
  lou.group.position.set(...louHome); lou.group.rotation.y = 0; scene.add(lou.group);

  const bob = createModel(GFX, CAST['staff:bob'], { detail: DETAIL.staff });
  const bobFloor = normalizeActorHeight(bob, HUMAN_HEIGHT);
  const bobHome = [BOB_HOME[0], bobFloor, BOB_HOME[2]];
  bob.group.position.set(...bobHome); bob.group.rotation.y = Math.atan2(-0.2, -1.2); scene.add(bob.group);

  const waiter = createModel(GFX, CAST['staff:waiter'], { detail: DETAIL.staff });
  const waiterFloor = normalizeActorHeight(waiter, HUMAN_HEIGHT);
  const waiterHome = [WAITER_HOME[0], waiterFloor, WAITER_HOME[2]];
  waiter.group.position.set(...waiterHome); waiter.group.rotation.y = Math.atan2(-6.4, 4.2); scene.add(waiter.group);

  const staffModels = [
    { model: lou, name: STAFF[0].name, time: 0, home: louHome, floor: louFloor, poseAccumulator: 0 },
    { model: bob, name: STAFF[1].name, time: 1.5, home: bobHome, floor: bobFloor, poseAccumulator: 0 },
    { model: waiter, name: STAFF[2].name, time: 2.5, home: waiterHome, floor: waiterFloor, poseAccumulator: 0, route: [waiterHome], routeStage: 'idle', routeCustomer: null },
  ];

  const playerModel = createModel(GFX, CAST.owner, { detail: DETAIL.owner });
  const playerScale = 0.86;
  const playerFloor = normalizeActorHeight(playerModel, HUMAN_HEIGHT) * playerScale;
  playerModel.group.scale.multiplyScalar(playerScale);
  const storedPlayer = window.__ventureCafeState?.playerPosition ?? { x: PLAYER_HOME[0], z: PLAYER_HOME[2] };
  const savedPlayer = storedPlayer.z > -4.2 ? { x: PLAYER_HOME[0], z: PLAYER_HOME[2] } : storedPlayer;
  const spot = navBlocked(savedPlayer.x, savedPlayer.z) ? nearestWalkable(savedPlayer.x, savedPlayer.z) : savedPlayer;
  const player = { model: playerModel, floor: playerFloor, x: spot.x, z: spot.z, time: 0, poseAccumulator: 0 };
  playerModel.group.position.set(player.x, playerFloor, player.z);
  playerModel.group.rotation.y = 0;
  scene.add(playerModel.group);
  const tagStyle = (accent, w = 256) => ({ background: '#355746', foreground: '#f5edd8', accent, width: w, height: 96, fontSize: 32 });
  const makeTag = (text, style, order) => {
    const mesh = new GFX.Mesh(new GFX.PlaneGeometry(style.width / 280, 0.22), new GFX.MeshBasicMaterial({ map: makeSignTexture(text, style), transparent: true, side: GFX.DoubleSide, depthTest: false, depthWrite: false }));
    mesh.renderOrder = order; scene.add(mesh);
    return mesh;
  };
  const ownerTag = makeTag('HEAD CHEF', tagStyle('#c2a26a'), 25);
  const playerKeys = new Set();
  const keyDirections = {
    KeyW: 'up', ArrowUp: 'up', w: 'up', W: 'up', KeyS: 'down', ArrowDown: 'down', s: 'down', S: 'down',
    KeyA: 'left', ArrowLeft: 'left', a: 'left', A: 'left', KeyD: 'right', ArrowRight: 'right', d: 'right', D: 'right',
  };
  const editableTarget = () => {
    const el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  };
  const clearPlayerKeys = () => playerKeys.clear();
  const onKeyDown = (event) => {
    if (event.key === 'Shift') { if (!editableTarget()) playerKeys.add('run'); return; }
    const direction = keyDirections[event.code] ?? keyDirections[event.key];
    if (!direction || editableTarget() || event.ctrlKey || event.metaKey || event.altKey) return;
    playerKeys.add(direction);
    if (event.shiftKey) playerKeys.add('run');
    event.preventDefault();
  };
  const onKeyUp = (event) => {
    const direction = keyDirections[event.code] ?? keyDirections[event.key];
    if (direction) playerKeys.delete(direction);
    if (event.key === 'Shift') playerKeys.delete('run');
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clearPlayerKeys);
  document.addEventListener('visibilitychange', clearPlayerKeys);
  document.querySelectorAll('[data-player-move]').forEach((button) => {
    const direction = button.dataset.playerMove;
    const down = (event) => { event.preventDefault(); playerKeys.add(direction); button.setPointerCapture?.(event.pointerId); };
    const up = () => playerKeys.delete(direction);
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('lostpointercapture', up);
    button.addEventListener('contextmenu', (event) => event.preventDefault());
  });

  // The purchasing manager joins at the receiving desk once hired; his model bakes in the background until then.
  let manager = null;
  const managerTag = makeTag('RAFAEL · BUYING', tagStyle('#d3b77d', 320), 24);
  managerTag.visible = false;
  function ensureManager() {
    if (manager) return manager;
    const model = createModel(GFX, CAST['staff:rafael'], { detail: DETAIL.staff });
    const floor = normalizeActorHeight(model, HUMAN_HEIGHT);
    model.group.position.set(MANAGER_HOME[0], floor, MANAGER_HOME[2]);
    model.group.rotation.y = Math.PI;
    scene.add(model.group);
    manager = { model, floor, time: 0, poseAccumulator: 0 };
    return manager;
  }

  const cats = CAT_ROSTER.map((cat, index) => {
    const model = createModel(GFX, CAST[`cat:${cat.id}`], { detail: DETAIL.cat });
    const floor = normalizeActorHeight(model, CAT_HEIGHT);
    const stops = CAT_PATROLS[index].map(([x, z]) => [x, 0, z]);
    const place = [stops[0][0], floor, stops[0][2]];
    model.group.position.set(...place);
    model.group.rotation.y = index * 1.5;
    scene.add(model.group);
    const route = planWalkRoute([place[0], 0, place[2]], stops.slice(1));
    return { ...cat, model, place, time: index * 3.7, route, distance: 0, wait: 0.4 + index * 0.55, poseAccumulator: 0, patrolStops: stops, patrolIndex: 0 };
  });

  // ——— customers: residents walk in off the sidewalk, shop, queue at the counter and leave ———
  const customerActors = new Map();
  const readyResidents = new Set(FIRST_WAVE);
  const servicePlates = new Map(CAFE_SERVICE_STOPS.map((stop) => {
    const plate = createBreakfastPlate(GFX, stop.plateKind);
    plate.position.set(stop.plateX, 0.84, stop.plateZ);
    plate.scale.setScalar(0.22);
    plate.visible = false;
    scene.add(plate);
    return [stop.id, plate];
  }));
  const stand = (productId) => { const [x, z] = SLOTS[productId].stand; return [x, 0, z]; };

  function setCustomerRoute(actor, customer) {
    const here = [actor.model.group.position.x, 0, actor.model.group.position.z];
    const seat = CAFE_SEATS.find((candidate) => candidate.id === customer.seatId) ?? CAFE_SEATS[customer.id % CAFE_SEATS.length];
    if (customer.phase === 'browsing') {
      actor.route = planWalkRoute(here, [DOOR_IN, [seat.x, 0, seat.z]]);
      actor.routeFraction = 0.72;
    } else if (customer.phase === 'checkout') {
      actor.route = planWalkRoute(here, [CHECKOUT]);
      actor.routeFraction = 0.94;
    } else {
      actor.route = planWalkRoute(here, [DOOR_IN, SIDEWALK_EXITS[customer.id % 2]]);
      actor.routeFraction = 0.94;
    }
    actor.seat = seat;
    actor.phase = customer.phase;
  }

  function createCustomerActor(customer) {
    const resident = RESIDENT_BY_ID[customer.residentId] ?? RESIDENTS.find((r) => r.character === customer.character) ?? RESIDENTS[customer.id % RESIDENTS.length];
    const model = createModel(GFX, CAST[`resident:${resident.id}`], { detail: DETAIL.resident });
    const floor = normalizeActorHeight(model, resident.height);
    const start = [SIDEWALK_SPAWN[0] + (customer.id % 3) * 0.5 - 0.5, 0, SIDEWALK_SPAWN[2]];
    model.group.position.set(start[0], floor, start[2]);
    scene.add(model.group);
    let catBadge = null;
    if (customer.catReaction === 'delighted' || customer.catReaction === 'annoyed') {
      const delighted = customer.catReaction === 'delighted';
      catBadge = new GFX.Mesh(
        new GFX.PlaneGeometry(0.34, 0.34),
        new GFX.MeshBasicMaterial({ map: makeSignTexture(delighted ? '♥' : '!', { background: delighted ? '#315b45' : '#8e4b3d', foreground: '#fff5de', accent: delighted ? '#9ac08a' : '#e2a17f', width: 128, height: 128, fontSize: 76 }), transparent: true, side: GFX.DoubleSide, depthTest: false, depthWrite: false }),
      );
      catBadge.renderOrder = 20;
      scene.add(catBadge);
    }
    const actor = { model, id: customer.id, catBadge, phase: null, route: [start], routeFraction: 0.6, time: customer.id * 0.7, poseAccumulator: 0, poseClip: 'idle', seatedAt: null, floor, start };
    customerActors.set(customer.id, actor);
    setCustomerRoute(actor, customer);
    // Someone restored mid-shop starts where their clock says they should be, not out on the street.
    return actor;
  }

  function disposeActor(actor) {
    scene.remove(actor.model.group);
    if (actor.catBadge) {
      scene.remove(actor.catBadge);
      actor.catBadge.geometry.dispose();
      actor.catBadge.material.map?.dispose();
      actor.catBadge.material.dispose();
    }
    actor.model.mesh.geometry.dispose();
  }

  function syncCustomers(state, dt) {
    const active = new Set(state.customers.map((c) => c.id));
    for (const [id, actor] of customerActors) {
      if (!active.has(id)) { disposeActor(actor); customerActors.delete(id); }
    }
    for (const customer of state.customers) {
      let actor = customerActors.get(customer.id);
      if (!actor) actor = createCustomerActor(customer);
      if (actor.phase !== customer.phase) setCustomerRoute(actor, customer);
      const elapsed = Math.max(0, customer.phaseTotal - customer.phaseTimer);
      const moveDuration = Math.max(0.01, customer.phaseTotal * actor.routeFraction);
      const progress = customer.phase === 'browsing'
        ? Math.min(1, Math.max(0, 1 - (customer.arrivalTimer ?? 0) / Math.max(0.01, customer.arrivalDuration ?? 2.4)))
        : Math.min(1, elapsed / moveDuration);
      const point = pointOnRoute(actor.route, progress);
      const ahead = pointOnRoute(actor.route, Math.min(1, progress + 0.025));
      const seated = progress >= 1 && customer.phase === 'browsing';
      actor.model.group.position.set(point[0], actor.floor, point[2]);
      if (progress < 1) faceAlong(actor.model.group, point, ahead);
      else if (seated && actor.seat) actor.model.group.rotation.y = actor.seat.yaw;
      else if (customer.phase === 'checkout') actor.model.group.rotation.y = Math.PI / 2;
      if (actor.catBadge) {
        actor.catBadge.position.set(point[0], actor.floor + 1.72, point[2]);
        actor.catBadge.quaternion.copy(stage.camera.quaternion);
        actor.catBadge.visible = customer.phase !== 'leaving';
      }
      actor.time += dt;
      actor.poseAccumulator += dt;
      if (actor.poseAccumulator >= 0.05) {
        const clip = progress < 1 ? 'walk' : seated ? 'sit' : customer.phase === 'checkout' ? 'idle' : 'look';
        let t = actor.time;
        if (clip === 'sit') {
          if (actor.poseClip !== 'sit') actor.seatedAt = actor.time;
          t = Math.min(0.45, Math.max(0, actor.time - (actor.seatedAt ?? actor.time)));
        } else {
          actor.seatedAt = null;
        }
        actor.model.pose({ clip, t, time: actor.time, seed: customer.id });
        actor.poseClip = clip;
        actor.poseAccumulator %= 0.05;
      }
    }
    for (const stop of CAFE_SERVICE_STOPS) {
      const occupiedAndServed = state.customers.some((customer) => {
        const seat = CAFE_SEATS.find((candidate) => candidate.id === customer.seatId);
        return seat?.tableId === stop.id && customer.phase === 'browsing' && customer.serviceStatus === 'served';
      });
      const plate = servicePlates.get(stop.id);
      if (plate) plate.visible = occupiedAndServed;
    }
  }

  function updateStaff(state, dt) {
    for (const worker of staffModels.slice(0, 2)) {
      worker.time += dt;
      worker.poseAccumulator += dt;
      if (worker.poseAccumulator >= 0.05) {
        const preparing = worker.name === 'Bob' && state.waiterWork?.stage === 'preparing-order';
        worker.model.pose({ clip: preparing ? 'look' : 'idle', t: worker.time, time: worker.time, seed: worker.name.length });
        worker.poseAccumulator %= 0.05;
      }
      worker.model.group.position.set(...worker.home);
    }
  }

  function updateWaiter(state, dt) {
    const actor = staffModels[2];
    const task = state.waiterWork ?? { stage: 'idle', customerId: null, seatId: null, timer: 0, duration: 0 };
    const stageName = task.stage ?? 'idle';
    const customer = state.customers.find((candidate) => candidate.id === task.customerId);
    const seat = CAFE_SEATS.find((candidate) => candidate.id === task.seatId);
    const stop = CAFE_SERVICE_STOPS.find((candidate) => candidate.id === seat?.tableId);
    const here = [actor.model.group.position.x, 0, actor.model.group.position.z];

    if (actor.routeStage !== stageName || actor.routeCustomer !== task.customerId) {
      const goingToDiner = ['walking-to-table', 'taking-order', 'walking-to-delivery', 'presenting'].includes(stageName);
      const destination = goingToDiner && stop
        ? [stop.x, 0, stop.z]
        : ['returning-to-kitchen', 'preparing-order'].includes(stageName)
          ? KITCHEN_PASS
          : [WAITER_HOME[0], 0, WAITER_HOME[2]];
      actor.route = planWalkRoute(here, [destination]);
      actor.routeStage = stageName;
      actor.routeCustomer = task.customerId;
    }

    let moving = false;
    if (['walking-to-table', 'returning-to-kitchen', 'walking-to-delivery', 'returning'].includes(stageName)) {
      const progress = Math.min(1, Math.max(0, 1 - task.timer / Math.max(0.01, task.duration)));
      const point = pointOnRoute(actor.route, progress);
      const ahead = pointOnRoute(actor.route, Math.min(1, progress + 0.035));
      actor.model.group.position.set(point[0], actor.floor, point[2]);
      if (progress < 1) faceAlong(actor.model.group, point, ahead);
      moving = progress < 1;
    } else if (['taking-order', 'preparing-order', 'presenting'].includes(stageName)) {
      const point = actor.route[actor.route.length - 1];
      actor.model.group.position.set(point[0], actor.floor, point[2]);
      if (seat && (stageName === 'taking-order' || stageName === 'presenting')) faceAlong(actor.model.group, point, [seat.x, 0, seat.z]);
    } else {
      actor.model.group.position.set(...actor.home);
    }

    actor.time += dt;
    actor.poseAccumulator += dt;
    if (actor.poseAccumulator >= 0.05) {
      actor.model.pose({ clip: moving ? 'walk' : 'idle', t: actor.time, time: actor.time, seed: actor.name.length });
      actor.poseAccumulator %= 0.05;
    }
  }

  function updateCats(dt) {
    for (const cat of cats) {
      cat.time += dt;
      cat.poseAccumulator = (cat.poseAccumulator ?? 0) + dt;
      const total = routeLength(cat.route);
      if (cat.wait > 0) {
        cat.wait -= dt;
        if (cat.poseAccumulator >= 0.08) {
          cat.model.pose({ clip: cat.wait > 1.2 ? 'sit' : 'look', t: cat.time, time: cat.time, seed: cat.time * 0.1, pace: 0.7 });
          cat.poseAccumulator %= 0.08;
        }
        continue;
      }
      cat.distance += dt * (cat.id === 'nyx' ? 0.52 : 0.62);
      const progress = total > 0 ? cat.distance / total : 1;
      if (progress >= 1) {
        cat.patrolIndex = (cat.patrolIndex + 1) % cat.patrolStops.length;
        const current = [cat.model.group.position.x, 0, cat.model.group.position.z];
        cat.route = findWalkPath(current, cat.patrolStops[cat.patrolIndex]);
        cat.distance = 0;
        cat.wait = 1.8 + ((cat.patrolIndex + cat.id.length) % 4) * 0.65;
        continue;
      }
      const point = pointOnRoute(cat.route, progress);
      const ahead = pointOnRoute(cat.route, Math.min(1, progress + 0.025));
      cat.model.group.position.set(point[0], cat.place[1], point[2]);
      faceAlong(cat.model.group, point, ahead);
      if (cat.poseAccumulator >= 0.05) {
        cat.model.pose({ clip: 'walk', t: cat.time, time: cat.time, seed: cat.id.length, pace: 0.8 });
        cat.poseAccumulator %= 0.05;
      }
    }
  }

  let fixtureKey = '';
  function syncFixtures(state) {
    const owned = state.fixtures ?? [], layout = state.layout ?? {};
    const key = owned.join(',') + JSON.stringify(layout);
    if (key === fixtureKey) return;
    fixtureKey = key;
    selection.state = state;
    setLayout(owned, layout);
    for (const views of fixtureViews.values()) for (const view of views) view.visible = false;
    for (const piece of PIECES) {
      const group = pieceViews.get(piece.id), p = placementOf(piece.id);
      group.position.set(p.x, 0, p.z); group.rotation.y = p.rot * Math.PI / 2;
    }
    for (const id of owned) for (const view of fixtureViews.get(id) ?? []) view.visible = true;
    // The stock on a moved piece moves with it.
    for (const [id, display] of displayGroups) {
      const slot = SLOTS[id];
      display.group.position.set(slot.x, slot.y, slot.z); display.group.rotation.y = slot.yaw;
    }
    drawSelection();
  }

  function syncDisplays(state) {
    syncFixtures(state);
    // Inventory quantities are reflected in the kitchen UI, not rendered as grocery shelf meshes.
    // Dry-store quantities are tracked in the cafe UI; no floating retail cartons are rendered behind the counter.
  }

  function updatePlayer(state, dt) {
    const canMove = state.started && !state.paused && !state.dayEnded && !state.gameOver;
    const horizontal = (playerKeys.has('right') ? 1 : 0) - (playerKeys.has('left') ? 1 : 0);
    const vertical = (playerKeys.has('up') ? 1 : 0) - (playerKeys.has('down') ? 1 : 0);
    const moving = canMove && (horizontal !== 0 || vertical !== 0);
    if (moving) {
      const [dx, dz] = screenMovementToWorld(horizontal, vertical, stage.view.yaw);
      const speed = PLAYER_SPEED * (playerKeys.has('run') ? 1.45 : 1);
      const nextX = player.x + dx * speed * dt;
      const nextZ = player.z + dz * speed * dt;
      // Resolve axes separately so the owner can slide along a shelf edge.
      if (!navBlocked(nextX, player.z)) player.x = nextX;
      if (!navBlocked(player.x, nextZ)) player.z = nextZ;
      playerModel.group.rotation.y = Math.atan2(dx, dz);
    }
    playerModel.group.position.set(player.x, player.floor, player.z);
    player.time += dt;
    player.poseAccumulator += dt;
    if (player.poseAccumulator >= 0.04) {
      playerModel.pose({ clip: moving ? 'walk' : 'idle', t: player.time, time: player.time, seed: 29, pace: playerKeys.has('run') ? 1.35 : 1 });
      player.poseAccumulator %= 0.04;
    }
    ownerTag.position.set(player.x, player.floor + 1.34, player.z);
    ownerTag.quaternion.copy(stage.camera.quaternion);
    ownerTag.visible = state.started;
    state.playerPosition = { x: player.x, z: player.z };
  }

  function updatePurchasingManager(state, dt) {
    const hired = Boolean(state.purchasingManagerHired);
    managerTag.visible = hired;
    if (!hired) { if (manager) manager.model.group.visible = false; return; }
    const m = ensureManager();
    m.model.group.visible = true;
    m.time += dt;
    m.poseAccumulator += dt;
    if (m.poseAccumulator >= 0.05) {
      m.model.pose({ clip: 'idle', t: m.time, time: m.time, seed: 43 });
      m.poseAccumulator %= 0.05;
    }
    managerTag.position.set(MANAGER_HOME[0], m.floor + 1.56, MANAGER_HOME[2]);
    managerTag.quaternion.copy(stage.camera.quaternion);
  }

  // The street door opens for anyone coming or going.
  let doorAngle = 0;
  function updateDoor(dt) {
    let near = false;
    const check = (x, z) => { if (Math.hypot(x - FRONT_DOOR.x, z - Z) < 1.9) near = true; };
    for (const actor of customerActors.values()) check(actor.model.group.position.x, actor.model.group.position.z);
    check(player.x, player.z);
    doorAngle = easeOpacity(doorAngle, near ? 1.35 : 0, dt, 6);
    doorLeaf.rotation.y = doorAngle;
  }

  // ——— the walls get out of the way ———
  let wallMode = 'auto';
  function updateWalls(dt) {
    const camera = [stage.camera.position.x, stage.camera.position.z];
    for (const w of wallGroups) {
      const target = wallOpacity({ camera, center: STORE_CENTER, normal: w.normal, both: w.both, mode: wallMode });
      w.opacity = easeOpacity(w.opacity, target, dt);
      if (Math.abs(w.opacity - w.applied) < 1e-4) continue;
      w.applied = w.opacity;
      for (const m of w.mats.values()) m.opacity = (m.baseOpacity ?? 1) * w.opacity;
      const solid = w.opacity > 0.55;
      for (const mesh of w.meshes) if (mesh.castShadow !== solid && mesh.material.baseOpacity === undefined) mesh.castShadow = solid;
    }
  }

  function update(state, dt, realTime = 0) {
    if (!state) return;
    state.availableResidents = readyResidents;
    syncDisplays(state);
    const actorDt = activeFrameDelta(state, dt);
    syncCustomers(state, actorDt);
    updateStaff(state, actorDt);
    updateWaiter(state, actorDt * 1.65);
    updateCats(actorDt);
    updatePlayer(state, dt);
    updatePurchasingManager(state, actorDt);
    updateDoor(dt);
    updateWalls(dt);
    stage.target.set(world.focus?.[0] ?? 0, 0.5, world.focus?.[1] ?? 0.8);
    if (stage.lantern) stage.lantern.intensity = 1.1 + Math.sin(realTime * 0.8) * 0.04;
  }

  // ——— rearranging: the piece being moved follows the pointer, green where it may go and red where it may not ———
  const ghostMaterial = new GFX.MeshBasicMaterial({ color: '#6fd08c', transparent: true, opacity: 0.5, depthWrite: false });
  const ghost = new GFX.Group(); ghost.visible = false; scene.add(ghost);
  const ghostBody = new GFX.Mesh(new GFX.BoxGeometry(1, 0.14, 1), ghostMaterial); ghost.add(ghostBody);
  const ghostFront = new GFX.Mesh(new GFX.BoxGeometry(0.5, 0.14, 0.2), ghostMaterial); ghost.add(ghostFront);
  const raycaster = new GFX.Raycaster();
  const placing = { pieceId: null, rot: 0, at: null, state: null, problem: null, pointer: null };
  function floorAt(event) {
    const r = host.getBoundingClientRect();
    raycaster.setFromCamera({ x: ((event.clientX - r.left) / r.width) * 2 - 1, y: -((event.clientY - r.top) / r.height) * 2 + 1 }, stage.camera);
    const { origin: o, direction: d } = raycaster.ray;
    if (Math.abs(d.y) < 1e-6) return null;
    const s = -o.y / d.y;
    return s > 0 ? { x: o.x + d.x * s, z: o.z + d.z * s } : null;
  }
  function refreshGhost() {
    if (!placing.pieceId || !placing.at) { ghost.visible = false; return; }
    const piece = PIECE_BY_ID[placing.pieceId];
    const p = snapPlacement(placing.pieceId, placing.at.x, placing.at.z, placing.rot);
    placing.rot = p.rot;
    placing.problem = placementProblem(placing.pieceId, p, placing.state?.fixtures ?? [], placing.state?.layout ?? {});
    placing.target = p;
    ghostBody.scale.set(piece.w, 1, piece.d); ghostBody.position.set(0, 0.07, 0);
    ghostFront.position.set(0, 0.07, piece.d / 2 + 0.1);
    ghost.position.set(p.x, 0.02, p.z); ghost.rotation.y = p.rot * Math.PI / 2;
    ghostMaterial.color.set(placing.problem ? '#e0523f' : '#6fd08c');
    ghost.visible = true;
  }
  const placementApi = {
    /** Pick a piece up: it follows the pointer until it is put down or cancelled. */
    start(pieceId, state) {
      const p = placementOf(pieceId, state.layout);
      Object.assign(placing, { pieceId, state, rot: p.rot, at: { x: p.x, z: p.z }, target: p, problem: null });
      drawSelection(); refreshGhost();
    },
    rotate() { if (placing.pieceId) { placing.rot = (placing.rot + 1) % 4; refreshGhost(); } },
    cancel() { placing.pieceId = null; placing.at = null; ghost.visible = false; drawSelection(); },
    get active() { return placing.pieceId; },
    get problem() { return placing.problem; },
    onPlace: null,
  };
  function dropAt(event) {
    if (!placing.pieceId) return;
    const at = floorAt(event);
    if (!at) return;
    placing.at = at; refreshGhost();
    if (placementApi.onPlace?.(placing.pieceId, placing.target) === true) placementApi.cancel();
  }
  // ——— selecting: click a piece to pick it out, click it again to pick it up ———
  const selectMaterial = new GFX.MeshBasicMaterial({ color: '#e6b95a', transparent: true, opacity: 0.55, depthWrite: false });
  const selectMarker = new GFX.Mesh(new GFX.BoxGeometry(1, 0.06, 1), selectMaterial); selectMarker.visible = false; scene.add(selectMarker);
  const selection = { id: null, onSelect: null, onPickUp: null };
  function drawSelection() {
    const piece = selection.id && PIECE_BY_ID[selection.id];
    if (!piece || placing.pieceId) { selectMarker.visible = false; return; }
    const box = footprint(piece, placementOf(piece.id));
    selectMarker.scale.set(box.w + 0.2, 1, box.d + 0.2);
    selectMarker.position.set(box.x, 0.03, box.z);
    selectMarker.visible = true;
  }
  function setSelected(id, { notify = true } = {}) {
    selection.id = id;
    drawSelection();
    if (notify) selection.onSelect?.(id);
  }
  /** The piece under a pointer: what the ray hits first, or failing that, the piece standing where it meets the floor. */
  function pieceAtPointer(event) {
    const r = host.getBoundingClientRect();
    raycaster.setFromCamera({ x: ((event.clientX - r.left) / r.width) * 2 - 1, y: -((event.clientY - r.top) / r.height) * 2 + 1 }, stage.camera);
    try {
      const targets = [];
      for (const [group] of pieceOfGroup) if (group.visible) targets.push(group);
      for (const display of displayGroups.values()) if (display.group.visible) targets.push(display.group);
      for (const hit of raycaster.intersectObjects(targets, true)) {
        if (hit.object.visible === false) continue;
        for (let node = hit.object; node; node = node.parent) {
          if (pieceOfGroup.has(node)) return pieceOfGroup.get(node);
          const display = [...displayGroups.values()].find((d) => d.group === node);
          if (display) return pieceOfProduct(display.product.id);
        }
      }
    } catch { /* fall back to the floor */ }
    const at = floorAt(event);
    if (!at) return null;
    const owned = new Set(selection.state?.fixtures ?? []);
    for (const piece of PIECES) {
      if (!isStanding(piece, owned)) continue;
      const box = footprint(piece, placementOf(piece.id));
      if (Math.abs(at.x - box.x) <= box.w / 2 + 0.15 && Math.abs(at.z - box.z) <= box.d / 2 + 0.15) return piece.id;
    }
    return null;
  }
  function pickAt(event) {
    const id = pieceAtPointer(event);
    if (id && id === selection.id) selection.onPickUp?.(id);
    else setSelected(id);
  }

  let tap = null;
  host.addEventListener('pointermove', (event) => {
    if (!placing.pieceId) return;
    if (event.pointerType === 'touch' && tap) return;
    const at = floorAt(event);
    if (at) { placing.at = at; refreshGhost(); }
  });
  host.addEventListener('pointerdown', (event) => { if (event.button === 0) tap = { x: event.clientX, y: event.clientY }; });
  host.addEventListener('pointerup', (event) => {
    if (!tap) return;
    const moved = Math.hypot(event.clientX - tap.x, event.clientY - tap.y);
    tap = null;
    if (moved >= 6 || event.button !== 0) return;
    if (placing.pieceId) dropAt(event); else pickAt(event);
  });
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
    if (placing.pieceId) {
      if (event.key === 'r' || event.key === 'R') { placementApi.rotate(); event.preventDefault(); }
      else if (event.key === 'Escape') { placementApi.cancel(); drawSelection(); placementApi.onCancel?.(); }
    } else if (selection.id) {
      if (event.key === 'm' || event.key === 'M') { selection.onPickUp?.(selection.id); event.preventDefault(); }
      else if (event.key === 'Escape') setSelected(null);
    }
  });

  // ——— camera: middle-button drag to orbit (a finger on touch screens), wheel to zoom ———
  let dragging = null;
  host.addEventListener('pointerdown', (event) => {
    if (!startsCameraDrag(event)) return;
    event.preventDefault();
    dragging = { id: event.pointerId, x: event.clientX, y: event.clientY };
    host.setPointerCapture?.(event.pointerId);
  });
  host.addEventListener('pointermove', (event) => {
    if (!dragging || dragging.id !== event.pointerId) return;
    if (!holdsCameraDrag(event)) { dragging = null; return; }                 // the button was let go somewhere we didn't see
    const dx = event.clientX - dragging.x, dy = event.clientY - dragging.y;
    dragging.x = event.clientX; dragging.y = event.clientY;
    stage.view.turn(-dx * 0.006, dy * 0.0038);
  });
  const stopDrag = (event) => { if (dragging && dragging.id === event.pointerId && endsCameraDrag(event)) dragging = null; };
  host.addEventListener('pointerup', stopDrag);
  host.addEventListener('pointercancel', (event) => { if (dragging?.id === event.pointerId) dragging = null; });
  // Keep the browser's own middle-click behavior (autoscroll, paste) off the scene.
  host.addEventListener('mousedown', (event) => { if (event.button === 1) event.preventDefault(); });
  host.addEventListener('auxclick', (event) => { if (event.button === 1) event.preventDefault(); });
  host.addEventListener('wheel', (event) => {
    event.preventDefault();
    stage.view.zoomBy(Math.exp(event.deltaY * 0.001));
  }, { passive: false });

  const run = stage.run((dt) => {
    stage.view.step(dt);
    update(window.__ventureCafeState ?? null, dt, performance.now() / 1000);
  });

  // The signage: a lit OPEN sign in the middle window.
  const openSign = signPlane(scene, 'OPEN', -1.4, 2.5, Z - 0.1, 1.25, 0.48, { background: '#285542', foreground: '#eff1d6', accent: '#8fc27e', fontSize: 56, width: 256, height: 96 });

  // ——— the rest of the neighborhood bakes in the background while the shop is open ———
  const background = backgroundJobs();
  for (const [name, detail] of background) {
    if (!name.startsWith('resident:')) continue;
    library.ready(name, detail).then(() => readyResidents.add(name.slice(9)));
  }
  if (typeof Worker === 'undefined') for (const r of RESIDENTS) readyResidents.add(r.id);
  library.preload(background);

  const world = {
    stage, scene, cats, staffModels, player, displayGroups, update, wallGroups, placement: placementApi, pieceAt: (x, y) => ({ piece: pieceAtPointer({ clientX: x, clientY: y }), floor: floorAt({ clientX: x, clientY: y }) }), selection: { get id() { return selection.id; }, select: (id) => setSelected(id, { notify: false }), set onSelect(fn) { selection.onSelect = fn; }, set onPickUp(fn) { selection.onPickUp = fn; } },
    get wallMode() { return wallMode; },
    setWallMode(mode) { if (WALL_MODES.includes(mode)) wallMode = mode; return wallMode; },
    cycleWallMode() { wallMode = WALL_MODES[(WALL_MODES.indexOf(wallMode) + 1) % WALL_MODES.length]; return wallMode; },
    readyResidents,
    focus: null,                      // [x, z] to aim the camera at; null for the middle of the shop
    setState(state) { window.__ventureCafeState = state; },
    setOpen(open) { openSign.material.color.set(open ? '#ffffff' : '#a0a0a0'); },
    dispose() { run?.(); clearPlayerKeys(); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', clearPlayerKeys); document.removeEventListener('visibilitychange', clearPlayerKeys); },
  };
  window.__ventureCafeWorld = world;
  onProgress('The shutters are ready', 100);
  return world;
}
