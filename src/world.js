import * as GFX from 'madness-engine/gfx';
import { createStage } from 'madness-engine/stage';
import { createView } from 'madness-engine/view';
import { bake as legacyBake } from 'madness-engine/models/legacy-bake';
import { floorTexture, wallTexture } from 'madness-engine/textures/venue';
import { paintRoom } from 'madness-engine/textures/rooms/town';
import { paintSky } from 'madness-engine/textures/skies/haze';
import { screenMovementToWorld, startsCameraDrag, holdsCameraDrag, endsCameraDrag } from './controls.js';
import { STAFF, RESIDENTS, RESIDENT_BY_ID, activeFrameDelta } from './sim.js';
import {
  SHELL, FRONT_DOOR, REAR_DOOR, KITCHEN, SIDEWALK, COUNTER, BACKBAR,
  DOOR_IN, SIDEWALK_SPAWN, SIDEWALK_EXITS, CHECKOUT, LOU_HOME, BOB_HOME, WAITER_HOME, KITCHEN_PASS, PLAYER_HOME,
  navBlocked, nearestWalkable, findWalkPath, planWalkRoute, routeLength, pointOnRoute, CAFE_SEATS, serviceStopFor, CAFE_PLACE_SETTINGS,
} from './layout.js';
import { wallOpacity, easeOpacity, WALL_MODES } from './walls.js';
import { buildPerson, FIRST_WAVE } from './people.js';
import { STREETSCAPE, STREET_MODELS } from './streetscape.js';
import { buildCafeFurniture, buildCafeKitchen, buildCafeBar, buildCafeBackbar } from './cafe.js';
import { createBreakfastPlate } from './cafe-food.js';

const PLAYER_SPEED = 2.25;
const BRICK_TILE = 2.25;                       // world units a brick texture tile covers
const STORE_CENTER = [0, 0];

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
  onProgress('Opening the cafe', 3);
  const params = new URLSearchParams(window.location.search);

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
   * partition, which hides the kitchen from either side.
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
  const br = KITCHEN;
  box(scene, (br.minX + br.maxX) / 2, 0.006, (br.minZ + br.maxZ) / 2, br.maxX - br.minX, 0.014, br.maxZ - br.minZ, mats.concrete, { castShadow: false });   // the kitchen's concrete
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

  // The kitchen's own walls, shorter than the shell: they hide the room from either side, so they fade from both.
  const partitionH = 1.1;
  const partNS = wall('kitchen-east', { normal: [1, 0], both: true });
  partNS.brick(br.maxX, partitionH / 2, (br.minZ + br.maxZ - T / 2) / 2, T, partitionH, br.maxZ - T / 2 - br.minZ, '#b9b2a2');   // from the back wall to the south partition's face
  const partEW = wall('kitchen-south', { normal: [0, 1], both: true });
  const gapL = br.doorX - br.doorWidth / 2, gapR = br.doorX + br.doorWidth / 2;
  partEW.brick((br.minX - T + gapL) / 2, partitionH / 2, br.maxZ, gapL - br.minX + T, partitionH, T, '#b9b2a2');
  partEW.brick((gapR + br.maxX + T / 2) / 2, partitionH / 2, br.maxZ, br.maxX + T / 2 - gapR, partitionH, T, '#b9b2a2');

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
  onProgress('Setting up the dining room and the kitchen', 70);
  buildCafeBar(GFX, scene, mats);
  buildCafeBackbar(GFX, scene);
  buildCafeKitchen(GFX, scene, mats);
  buildCafeFurniture(GFX, scene);

  // ——— people: the crew and the first regulars are built behind the loading screen, the rest while the cafe is open ———
  const people = new Map();
  const personFor = (name) => {
    let built = people.get(name);
    if (!built) { built = buildPerson(GFX, name); people.set(name, built); }
    return built;
  };
  const firstPeople = ['staff:lou', 'staff:bob', 'staff:waiter', 'owner', ...FIRST_WAVE.map((id) => `resident:${id}`)];
  for (const [index, name] of firstPeople.entries()) {
    onProgress(`Bringing in the crew and the regulars · ${index + 1} of ${firstPeople.length}`, 74 + (index / firstPeople.length) * 22);
    await new Promise((resolve) => setTimeout(resolve, 0));        // let the loading screen repaint between people
    personFor(name);
  }

  const crewAt = (name, home, yaw) => {
    const model = personFor(name);
    model.group.position.set(home[0], 0, home[2]); model.group.rotation.y = yaw; scene.add(model.group);
    return model;
  };
  const louHome = [LOU_HOME[0], 0, LOU_HOME[2]], bobHome = [BOB_HOME[0], 0, BOB_HOME[2]], waiterHome = [WAITER_HOME[0], 0, WAITER_HOME[2]];
  const lou = crewAt('staff:lou', louHome, 0);
  const bob = crewAt('staff:bob', bobHome, Math.PI)       // facing the cooktop;
  const waiter = crewAt('staff:waiter', waiterHome, Math.atan2(-6.4, 4.2));

  const staffModels = [
    { model: lou, name: STAFF[0].name, time: 0, home: louHome, floor: 0, poseAccumulator: 0 },
    { model: bob, name: STAFF[1].name, time: 1.5, home: bobHome, floor: 0, poseAccumulator: 0 },
    { model: waiter, name: STAFF[2].name, time: 2.5, home: waiterHome, floor: 0, poseAccumulator: 0, route: [waiterHome], routeStage: 'idle', routeCustomer: null },
  ];

  const playerModel = personFor('owner');
  const playerFloor = 0;
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
  const ownerTag = makeTag('OWNER', tagStyle('#c2a26a'), 25);
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

  // ——— customers: residents walk in off the sidewalk, take a seat, are served, pay at the counter and leave ———
  const customerActors = new Map();
  const readyResidents = new Set(FIRST_WAVE);
  const servicePlates = new Map(CAFE_PLACE_SETTINGS.map((place) => {
    const plate = createBreakfastPlate(GFX, place.plateKind);
    plate.position.set(place.x, place.y + 0.02, place.z);
    plate.scale.setScalar(0.22);
    plate.visible = false;
    scene.add(plate);
    return [place.seatId, plate];
  }));

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
    const resident = RESIDENT_BY_ID[customer.residentId] ?? RESIDENTS[customer.id % RESIDENTS.length];
    const model = personFor(`resident:${resident.id}`);
    const floor = 0;
    const start = [SIDEWALK_SPAWN[0] + (customer.id % 3) * 0.5 - 0.5, 0, SIDEWALK_SPAWN[2]];
    model.group.position.set(start[0], floor, start[2]);
    scene.add(model.group);
    const actor = { model, id: customer.id, phase: null, route: [start], routeFraction: 0.6, time: customer.id * 0.7, poseAccumulator: 0, poseClip: 'idle', seatedAt: null, floor, start };
    customerActors.set(customer.id, actor);
    setCustomerRoute(actor, customer);
    // Someone restored mid-meal starts where their clock says they should be, not out on the street.
    return actor;
  }

  function disposeActor(actor) {
    // The person stays built, ready for the next time they come in.
    scene.remove(actor.model.group);
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
      // A seated diner's hips drop onto the seat by themselves (the `sit` clip), so they stay on the floor plane.
      actor.model.group.position.set(point[0], actor.floor, point[2]);
      if (progress < 1) faceAlong(actor.model.group, point, ahead);
      else if (seated && actor.seat) actor.model.group.rotation.y = actor.seat.yaw;
      else if (customer.phase === 'checkout') actor.model.group.rotation.y = Math.PI / 2;
      actor.time += dt;
      actor.poseAccumulator += dt;
      if (actor.poseAccumulator >= 0.05) {
        const clip = progress < 1 ? 'walk' : seated ? 'sit' : 'idle';
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
    for (const [seatId, plate] of servicePlates) {
      plate.visible = state.customers.some((customer) => customer.seatId === seatId && customer.phase === 'browsing' && customer.serviceStatus === 'served');
    }
  }

  function updateStaff(state, dt) {
    for (const worker of staffModels.slice(0, 2)) {
      worker.time += dt;
      worker.poseAccumulator += dt;
      if (worker.poseAccumulator >= 0.05) {
        const preparing = worker.name === 'Bob' && state.waiterWork?.stage === 'preparing-order';
        worker.model.pose({ clip: preparing ? 'talk' : 'idle', t: worker.time, time: worker.time, seed: worker.name.length });
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
    const stop = serviceStopFor(seat);
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
      // Resolve axes separately so the owner can slide along a counter edge.
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
    ownerTag.position.set(player.x, player.floor + 1.72, player.z);
    ownerTag.quaternion.copy(stage.camera.quaternion);
    ownerTag.visible = state.started;
    state.playerPosition = { x: player.x, z: player.z };
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
    const actorDt = activeFrameDelta(state, dt);
    syncCustomers(state, actorDt);
    updateStaff(state, actorDt);
    updateWaiter(state, actorDt * 1.65);
    updatePlayer(state, dt);
    updateDoor(dt);
    updateWalls(dt);
    stage.target.set(world.focus?.[0] ?? 0, 0.5, world.focus?.[1] ?? 0.8);
    if (stage.lantern) stage.lantern.intensity = 1.1 + Math.sin(realTime * 0.8) * 0.04;
  }

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

  // ——— the rest of the neighborhood is built while the cafe is open: one person every moment or two ———
  const waiting = RESIDENTS.map((resident) => resident.id).filter((id) => !readyResidents.has(id));
  let buildTimer = null;
  const buildNext = () => {
    const id = waiting.shift();
    if (!id) return;
    personFor(`resident:${id}`);
    readyResidents.add(id);
    buildTimer = setTimeout(buildNext, 600);
  };
  buildTimer = setTimeout(buildNext, 2500);

  const world = {
    stage, scene, staffModels, player, update, wallGroups,
    get wallMode() { return wallMode; },
    setWallMode(mode) { if (WALL_MODES.includes(mode)) wallMode = mode; return wallMode; },
    cycleWallMode() { wallMode = WALL_MODES[(WALL_MODES.indexOf(wallMode) + 1) % WALL_MODES.length]; return wallMode; },
    readyResidents,
    focus: null,                      // [x, z] to aim the camera at; null for the middle of the cafe
    setState(state) { window.__ventureCafeState = state; },
    setOpen(open) { openSign.material.color.set(open ? '#ffffff' : '#a0a0a0'); },
    dispose() { run?.(); clearTimeout(buildTimer); clearPlayerKeys(); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', clearPlayerKeys); document.removeEventListener('visibilitychange', clearPlayerKeys); },
  };
  window.__ventureCafeWorld = world;
  onProgress('The shutters are ready', 100);
  return world;
}
