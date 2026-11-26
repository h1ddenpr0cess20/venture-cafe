/**
 * The cafe's floor plan and everything that walks across it: the shell's doors, the dining room's furniture,
 * the kitchen, and the waypoint pathfinder guests and staff share. No rendering in here, so it can be tested
 * on its own.
 *
 * x runs left to right, z from the back of the cafe (negative) to the street (positive). The default camera
 * looks in from the street.
 */

// ——— the shell ———
export const SHELL = { minX: -9, maxX: 9, minZ: -7, maxZ: 7, wall: 0.3, height: 4.4 };
export const FRONT_DOOR = { x: 2.4, width: 1.5 };            // the street door, in the front wall (z = maxZ)
export const REAR_DOOR = { x: -5.7, width: 1.3 };            // the delivery door to the alley, in the back wall (z = minZ)
/** The kitchen: walled off at the back left, with an opening to the dining room. */
export const KITCHEN = { minX: -8.8, maxX: -4.6, minZ: -6.85, maxZ: -2.2, doorX: -6.7, doorWidth: 1.6 };
export const SIDEWALK = { minZ: 7.15, maxZ: 10.2 };

/** The inside of the walls. */
export const INNER = { minX: -8.85, maxX: 8.85, minZ: -6.85, maxZ: 6.85 };

export const COUNTER = { x: 3.8, z: -5.45, w: 7.6, d: 1.05, top: 0.95 }; // long service bar
// The world is the engine's real-size people and furniture brought down to WORLD_SCALE, so a person stands
// 1.44 tall here and a chair's seat is 0.47 m real, SEAT_TOP here. A seated person's hips drop onto it by
// themselves (the `sit` clip), so nothing is lifted.
export const WORLD_SCALE = 0.82;
export const SEAT_TOP = 0.47 * WORLD_SCALE;
export const TABLE_TOP = 0.77 * WORLD_SCALE;
export const BAR_STOOL_TOP = 0.75 * WORLD_SCALE;
export const BACKBAR = { x: 3.8, z: -6.65, w: 7.3, d: 0.32 };
/** The kitchen's two counters (cafe.js builds them): the prep counter with the cooktop, and the pass with the shelf above. */
export const KITCHEN_FIXTURES = {
  prep: { x: -6.7, z: -4.55, w: 3.75, d: 0.94 },
  pass: { x: -6.7, z: -2.72, w: 3.65, d: 0.76 },
};
export const CAFE_TABLES = [
  { id: 'table-a', x: -3.35, z: 0.55, w: 1.35, d: 0.9 },
  { id: 'table-b', x: 0.25, z: 0.55, w: 1.35, d: 0.9 },
  { id: 'table-c', x: -3.35, z: 4.25, w: 1.35, d: 0.9 },
  { id: 'table-d', x: 0.25, z: 4.25, w: 1.35, d: 0.9 },
];
export const CAFE_BOOTHS = [
  { id: 'booth-a', x: -7.65, z: 0.55, depth: 2.0 },
  { id: 'booth-b', x: -7.65, z: 4.25, depth: 2.0 },
];
export const CAFE_BAR_STOOLS = [
  { id: 'bar-1', x: 0.7, z: -4.05, yaw: Math.PI },
  { id: 'bar-2', x: 2.45, z: -4.05, yaw: Math.PI },
  { id: 'bar-3', x: 4.2, z: -4.05, yaw: Math.PI },
  { id: 'bar-4', x: 5.95, z: -4.05, yaw: Math.PI },
];
export const CAFE_SEATS = [
  ...CAFE_TABLES.flatMap((table) => [
    { id: `${table.id}-west`, x: table.x - 1.0, z: table.z, yaw: Math.PI / 2, tableId: table.id, style: 'chair' },
    { id: `${table.id}-east`, x: table.x + 1.0, z: table.z, yaw: -Math.PI / 2, tableId: table.id, style: 'chair' },
  ]),
  { id: 'booth-a-1', x: -7.85, z: 0.0, yaw: Math.PI / 2, tableId: 'booth-a', style: 'booth' },
  { id: 'booth-a-2', x: -7.85, z: 1.1, yaw: Math.PI / 2, tableId: 'booth-a', style: 'booth' },
  { id: 'booth-b-1', x: -7.85, z: 3.7, yaw: Math.PI / 2, tableId: 'booth-b', style: 'booth' },
  { id: 'booth-b-2', x: -7.85, z: 4.8, yaw: Math.PI / 2, tableId: 'booth-b', style: 'booth' },
  ...CAFE_BAR_STOOLS.map((seat) => ({ ...seat, tableId: 'bar', style: 'stool' })),
];
export const CAFE_SERVICE_STOPS = [
  ...CAFE_TABLES.map((table) => ({
    id: table.id,
    x: table.x,
    z: table.z + table.d / 2 + 0.85,
    plateX: table.x,
    plateZ: table.z,
    plateKind: table.id === 'table-a' ? 'scramble' : table.id === 'table-b' ? 'sunny' : 'omelette',
  })),
  ...CAFE_BOOTHS.map((booth) => ({
    id: booth.id,
    x: -4.75,
    z: booth.z,
    plateX: -6.7,
    plateZ: booth.z,
    plateKind: 'omelette',
  })),
];
/** A place setting in front of each dining seat, so every diner's meal lands on the table in front of them. */
const PLATE_KINDS = ['scramble', 'sunny', 'omelette'];
export const CAFE_PLACE_SETTINGS = CAFE_SEATS.filter((seat) => seat.style !== 'stool').map((seat, index) => ({
  seatId: seat.id,
  tableId: seat.tableId,
  x: seat.style === 'booth' ? -6.7 : seat.x + Math.sin(seat.yaw) * 0.62,
  z: seat.z,
  plateKind: PLATE_KINDS[index % PLATE_KINDS.length],
}));
export const CAFE_FURNITURE = [
  // A table blocks its top less the 0.15 at each end that a diner's knees go under, so a seat beside it is reachable.
  ...CAFE_TABLES.map((table) => ({ x: table.x, z: table.z, w: table.w - 0.3, d: table.d })),
  ...CAFE_BOOTHS.map((booth) => ({ x: booth.x - 0.67, z: booth.z, w: 0.14, d: booth.depth + 0.12 })),
];
export const CAFE_EXTERIOR_BLOCKERS = []; // The entrance is clear; the old mascot plinths were removed.

// ——— where people go ———
export const DOOR_IN = [FRONT_DOOR.x, 0, 6.5];
export const SIDEWALK_SPAWN = [FRONT_DOOR.x + 0.2, 0, 9.5];
export const SIDEWALK_EXITS = [[-6.5, 0, 9.5], [8.2, 0, 9.5]];
export const CHECKOUT = [3.8, 0, -4.05];
export const LOU_HOME = [3.8, 0, -6.35];                    // counter host behind the service bar
export const BOB_HOME = [-7.0, 0, -3.55];                  // Bob's station, in the walkway between the prep counter and the pass
export const WAITER_HOME = [6.4, 0, -1.8];                 // dining-room service station
export const KITCHEN_PASS = [-6.7, 0, -1.82];                 // just outside the kitchen pass
export const PLAYER_HOME = [1.1, 0, -6.35];

/**
 * The street furniture round the shop, from the engine's `scenery/street` (world.js stands the
 * models up; see streetscape.js). x runs along the street, z from the alley (negative) out to the
 * road. Each stands on y = 0 facing +z, turned by `yaw`; `r` is the room it takes up, which people
 * walk round.
 */
export const STREET_ITEMS = [
  // Sodium lamps along the curb, their arms out over the road.
  { model: 'streetlamp', x: -3.4, z: 10.05, yaw: -Math.PI / 2, r: 0.2 },
  { model: 'streetlamp', x: 7.6, z: 10.05, yaw: -Math.PI / 2, r: 0.2 },
  { model: 'hydrant', x: 5.2, z: 10.05, yaw: 0, r: 0.25 },
  { model: 'mailbox', x: 9.9, z: 10.0, yaw: -0.2, r: 0.3 },
  { model: 'bin', x: -8.6, z: 10.0, yaw: 0.3, r: 0.4 },
  { model: 'bench', x: -11.4, z: 9.95, yaw: 0, r: 0.8 },
  // Shrubs either side of the door.
  { model: 'shrub', x: -2.0, z: 7.85, yaw: 0.4, scale: 1.35, r: 0.5 },
  { model: 'shrub', x: 6.85, z: 7.85, yaw: 2.1, scale: 1.35, r: 0.5 },
  // The alley behind the delivery door.
  { model: 'dumpster', x: 8.0, z: -9.4, yaw: 0, r: 1.0 },
  { model: 'bin', x: -3.4, z: -8.3, yaw: 2.6, r: 0.4 },
];


// ——— navigation ———
// Footprints are inflated by `clearance` so a guest has room for their
// shoulders; the same grid drives guests, staff and the owner.
export const NAV = { minX: -8.5, maxX: 8.5, minZ: -6.5, maxZ: 10.3, step: 0.3, clearance: 0.34 };

const w = SHELL.wall;
const doorL = FRONT_DOOR.x - FRONT_DOOR.width / 2, doorR = FRONT_DOOR.x + FRONT_DOOR.width / 2;
const gapL = KITCHEN.doorX - KITCHEN.doorWidth / 2, gapR = KITCHEN.doorX + KITCHEN.doorWidth / 2;
export const NAV_BLOCKERS = [
  // the front wall, broken at the door
  { x: (-SHELL.maxX - 0.1 + doorL) / 2, z: SHELL.maxZ, w: doorL + SHELL.maxX + 0.1, d: w + 0.04 },
  { x: (doorR + SHELL.maxX + 0.1) / 2, z: SHELL.maxZ, w: SHELL.maxX + 0.1 - doorR, d: w + 0.04 },
  // the kitchen's walls, broken at the door to the floor
  { x: KITCHEN.maxX, z: (KITCHEN.minZ + KITCHEN.maxZ) / 2, w, d: KITCHEN.maxZ - KITCHEN.minZ },
  { x: (KITCHEN.minX + gapL) / 2, z: KITCHEN.maxZ, w: gapL - KITCHEN.minX, d: w },
  { x: (gapR + KITCHEN.maxX) / 2, z: KITCHEN.maxZ, w: KITCHEN.maxX - gapR, d: w },
  ...Object.values(KITCHEN_FIXTURES),
  { x: COUNTER.x, z: COUNTER.z, w: COUNTER.w, d: COUNTER.d },
  ...CAFE_FURNITURE,
  ...CAFE_EXTERIOR_BLOCKERS,
  ...STREET_ITEMS.map((p) => ({ x: p.x, z: p.z, w: p.r * 2, d: p.r * 2 })),
];

const inside = (b, x, z, r) => x >= b.x - b.w / 2 - r && x <= b.x + b.w / 2 + r && z >= b.z - b.d / 2 - r && z <= b.z + b.d / 2 + r;

export function navBlocked(x, z) {
  if (x < NAV.minX || x > NAV.maxX || z < NAV.minZ || z > NAV.maxZ) return true;
  const r = NAV.clearance;
  return NAV_BLOCKERS.some((b) => inside(b, x, z, r));
}

export function nearestWalkable(x, z) {
  const ix = Math.round((x - NAV.minX) / NAV.step);
  const iz = Math.round((z - NAV.minZ) / NAV.step);
  for (let radius = 0; radius <= 12; radius++) {
    for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
      const gx = NAV.minX + (ix + dx) * NAV.step;
      const gz = NAV.minZ + (iz + dz) * NAV.step;
      if (!navBlocked(gx, gz)) return { ix: ix + dx, iz: iz + dz, x: gx, z: gz };
    }
  }
  return { ix, iz, x, z };
}

function heapPush(heap, item) {
  let i = heap.length;
  heap.push(item);
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (heap[parent].f <= item.f) break;
    heap[i] = heap[parent]; i = parent;
  }
  heap[i] = item;
}

function heapPop(heap) {
  const first = heap[0];
  const last = heap.pop();
  if (heap.length) {
    let i = 0;
    while (true) {
      let child = i * 2 + 1;
      if (child >= heap.length) break;
      if (child + 1 < heap.length && heap[child + 1].f < heap[child].f) child++;
      if (heap[child].f >= last.f) break;
      heap[i] = heap[child]; i = child;
    }
    heap[i] = last;
  }
  return first;
}

const gridKey = (ix, iz) => `${ix},${iz}`;
const gridWorld = (ix, iz) => [NAV.minX + ix * NAV.step, 0, NAV.minZ + iz * NAV.step];

function segmentClear(a, b) {
  const dx = b[0] - a[0], dz = b[2] - a[2];
  const samples = Math.max(2, Math.ceil(Math.hypot(dx, dz) / 0.16));
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    if (navBlocked(a[0] + dx * t, a[2] + dz * t)) return false;
  }
  return true;
}

/**
 * A smoothed route from `start` to `end` ([x, y, z] each) around the fixtures. If
 * there is no way through, it is the straight line between them, or null if `strict`.
 */
export function findWalkPath(start, end, { strict = false } = {}) {
  const source = nearestWalkable(start[0], start[2]);
  const target = nearestWalkable(end[0], end[2]);
  const startKey = gridKey(source.ix, source.iz), targetKey = gridKey(target.ix, target.iz);
  const open = [];
  const previous = new Map();
  const score = new Map([[startKey, 0]]);
  const closed = new Set();
  const heuristic = (x, z) => Math.hypot(target.ix - x, target.iz - z);
  heapPush(open, { ix: source.ix, iz: source.iz, key: startKey, g: 0, f: heuristic(source.ix, source.iz) });
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let found = false, iterations = 0;
  while (open.length && iterations++ < 9000) {
    const node = heapPop(open);
    if (closed.has(node.key)) continue;
    if (node.key === targetKey) { found = true; break; }
    closed.add(node.key);
    for (const [dx, dz] of directions) {
      const ix = node.ix + dx, iz = node.iz + dz, point = gridWorld(ix, iz), key = gridKey(ix, iz);
      if (closed.has(key) || navBlocked(point[0], point[2])) continue;
      if (dx && dz) {
        const a = gridWorld(node.ix + dx, node.iz), b = gridWorld(node.ix, node.iz + dz);
        if (navBlocked(a[0], a[2]) || navBlocked(b[0], b[2])) continue;
      }
      const g = node.g + (dx && dz ? 1.4142 : 1);
      if (g >= (score.get(key) ?? Infinity)) continue;
      score.set(key, g); previous.set(key, node.key);
      heapPush(open, { ix, iz, key, g, f: g + heuristic(ix, iz) });
    }
  }
  if (!found) return strict ? null : [[...start], [...end]];
  const cells = [];
  let cursor = targetKey;
  while (cursor) {
    const [ix, iz] = cursor.split(',').map(Number);
    cells.push(gridWorld(ix, iz));
    if (cursor === startKey) break;
    cursor = previous.get(cursor);
  }
  cells.reverse();
  const raw = [[start[0], 0, start[2]], ...cells, [end[0], 0, end[2]]];
  const deduped = raw.filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[2] - a[i - 1][2]) > 0.12);
  const smooth = [deduped[0]];
  let at = 0;
  while (at < deduped.length - 1) {
    let next = at + 1;
    for (let candidate = deduped.length - 1; candidate > at + 1; candidate--) {
      if (segmentClear(deduped[at], deduped[candidate])) { next = candidate; break; }
    }
    smooth.push(deduped[next]); at = next;
  }
  return smooth;
}

/** One route through several stops in turn. */
export function planWalkRoute(start, stops) {
  let current = [start[0], 0, start[2]];
  const route = [current];
  for (const stop of stops) {
    const segment = findWalkPath(current, stop);
    route.push(...segment.slice(1));
    current = route[route.length - 1];
  }
  return route.length > 1 ? route : [current, [...current]];
}

export function routeLength(route) {
  let length = 0;
  for (let i = 1; i < route.length; i++) length += Math.hypot(route[i][0] - route[i - 1][0], route[i][2] - route[i - 1][2]);
  return length;
}

/** The point `progress` (0–1) of the way along a route. */
export function pointOnRoute(route, progress) {
  if (!route?.length) return [0, 0, 0];
  const total = routeLength(route);
  if (total < 1e-5) return [...route[route.length - 1]];
  let remaining = Math.max(0, Math.min(1, progress)) * total;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i];
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (remaining <= length || i === route.length - 1) {
      const t = length > 1e-5 ? Math.max(0, Math.min(1, remaining / length)) : 1;
      return [a[0] + (b[0] - a[0]) * t, 0, a[2] + (b[2] - a[2]) * t];
    }
    remaining -= length;
  }
  return [...route[route.length - 1]];
}
