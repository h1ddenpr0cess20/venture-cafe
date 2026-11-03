import { buildPan } from 'madness-engine/props/pan/index';
import { createStatic } from 'madness-engine/models/model';
import { GROCERIES } from 'madness-engine/props/groceries';
import { COUNTER, CAFE_TABLES, CAFE_BOOTHS, CAFE_BAR_STOOLS, CAFE_SEATS, TABLE_TOP, SEAT_TOP } from './layout.js';
import { createBreakfastPlate } from './cafe-food.js';

function box(GFX, parent, x, y, z, w, h, d, material) {
  const mesh = new GFX.Mesh(new GFX.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function cylinder(GFX, parent, x, y, z, rt, rb, h, material, segments = 24) {
  const mesh = new GFX.Mesh(new GFX.CylinderGeometry(rt, rb, h, segments), material);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

/**
 * A café dining chair in the game's own palette: a walnut frame, a green cushion and a brass cap on each
 * back post. Facing +z like a diner, standing on y = 0, the seat's top SEAT_TOP up and the back to about 0.92.
 */
function buildChair(GFX, { frame, rail, cushion, trim }) {
  const chair = new GFX.Group();
  const w = 0.46, d = 0.44, leg = 0.045, seatY = SEAT_TOP - 0.045;
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    box(GFX, chair, x * (w / 2 - leg / 2), seatY / 2, z * (d / 2 - leg / 2), leg, seatY, leg, frame);
  }
  for (const y of [0.13, 0.22]) {
    box(GFX, chair, 0, y, d / 2 - leg / 2, w - leg * 2, 0.025, 0.025, rail);
    for (const x of [-1, 1]) box(GFX, chair, x * (w / 2 - leg / 2), y, 0, 0.025, 0.025, d - leg * 2, rail);
  }
  box(GFX, chair, 0, seatY + 0.0175, 0, w, 0.035, d, frame);
  box(GFX, chair, 0, SEAT_TOP - 0.01, 0.01, w - 0.06, 0.04, d - 0.06, cushion);
  const backZ = -(d / 2 - leg / 2), backH = 0.92 - SEAT_TOP;
  for (const x of [-1, 1]) {
    box(GFX, chair, x * (w / 2 - leg / 2), SEAT_TOP + backH / 2, backZ, leg, backH, leg, frame);
    box(GFX, chair, x * (w / 2 - leg / 2), 0.93, backZ, leg + 0.012, 0.02, leg + 0.012, trim);
  }
  box(GFX, chair, 0, 0.86, backZ, w - 0.02, 0.07, 0.03, rail);
  for (const x of [-0.12, 0, 0.12]) box(GFX, chair, x, 0.68, backZ, 0.06, 0.3, 0.02, frame);
  return chair;
}

export function buildCafeFurniture(GFX, scene) {
  const walnut = new GFX.MeshStandardMaterial({ color: '#60432f', roughness: 0.78 });
  const walnutLight = new GFX.MeshStandardMaterial({ color: '#9b704b', roughness: 0.7 });
  const brass = new GFX.MeshStandardMaterial({ color: '#b99a61', metalness: 0.58, roughness: 0.34 });
  const upholstery = new GFX.MeshStandardMaterial({ color: '#315b4c', roughness: 0.86 });
  const upholsteryLight = new GFX.MeshStandardMaterial({ color: '#547564', roughness: 0.88 });
  const porcelain = new GFX.MeshStandardMaterial({ color: '#f4eedf', roughness: 0.28 });
  for (const table of CAFE_TABLES) {
    cylinder(GFX, scene, table.x, 0.33, table.z, 0.13, 0.22, TABLE_TOP - 0.12, brass, 20);
    cylinder(GFX, scene, table.x, 0.075, table.z, 0.34, 0.34, 0.12, walnut, 24);
    box(GFX, scene, table.x, TABLE_TOP - 0.04, table.z, table.w, 0.08, table.d, walnutLight);
    box(GFX, scene, table.x, TABLE_TOP + 0.005, table.z, table.w - 0.1, 0.012, table.d - 0.1, walnut);
  }
  for (const booth of CAFE_BOOTHS) {
    box(GFX, scene, booth.x - 0.22, (SEAT_TOP - 0.06) / 2, booth.z, 1.05, SEAT_TOP - 0.06, booth.depth + 0.08, walnut);
    box(GFX, scene, booth.x + 0.08, SEAT_TOP - 0.035, booth.z, 0.88, 0.07, booth.depth - 0.12, upholsteryLight);
    box(GFX, scene, booth.x - 0.72, 0.6, booth.z, 0.14, 0.8, booth.depth + 0.12, upholstery);
    for (const zOffset of [-booth.depth / 2 + 0.08, booth.depth / 2 - 0.08]) {
      box(GFX, scene, booth.x - 0.22, 0.4, booth.z + zOffset, 0.9, 0.44, 0.14, walnut);
      box(GFX, scene, booth.x - 0.22, 0.65, booth.z + zOffset, 0.82, 0.07, 0.12, upholstery);
    }
    cylinder(GFX, scene, -5.85, 0.33, booth.z, 0.11, 0.16, TABLE_TOP - 0.12, brass, 18);
    cylinder(GFX, scene, -5.85, 0.075, booth.z, 0.3, 0.3, 0.12, walnut, 24);
    box(GFX, scene, -5.85, TABLE_TOP - 0.04, booth.z, 1.1, 0.08, 1.05, walnutLight);
    box(GFX, scene, -5.85, TABLE_TOP + 0.005, booth.z, 1.0, 0.012, 0.95, walnut);
  }
  for (const seat of CAFE_SEATS.filter((candidate) => candidate.style === 'chair')) {
    const chair = buildChair(GFX, { frame: walnut, rail: walnutLight, cushion: upholstery, trim: brass });
    chair.position.set(seat.x, 0, seat.z); chair.rotation.y = seat.yaw; scene.add(chair);
  }
  for (const seat of CAFE_BAR_STOOLS) {
    cylinder(GFX, scene, seat.x, 0.6, seat.z, 0.25, 0.27, 0.09, upholstery, 28);
    cylinder(GFX, scene, seat.x, 0.3, seat.z, 0.045, 0.06, 0.56, brass, 16);
    cylinder(GFX, scene, seat.x, 0.035, seat.z, 0.25, 0.25, 0.06, walnut, 24);
    const footrest = new GFX.Mesh(new GFX.TorusGeometry(0.21, 0.018, 8, 28), brass);
    footrest.rotation.x = Math.PI / 2; footrest.position.set(seat.x, 0.26, seat.z); scene.add(footrest);
  }
  const cupMat = new GFX.MeshStandardMaterial({ color: '#eee5d4', roughness: 0.23 });
  const coffee = new GFX.MeshStandardMaterial({ color: '#493326', roughness: 0.2 });
  for (const [x, z] of [[0.9, -5.45], [2.15, -5.45]]) {
    cylinder(GFX, scene, x, COUNTER.top + 0.1, z, 0.09, 0.08, 0.18, cupMat, 24);
    cylinder(GFX, scene, x, COUNTER.top + 0.195, z, 0.075, 0.075, 0.012, coffee, 24);
    const handle = new GFX.Mesh(new GFX.TorusGeometry(0.045, 0.012, 8, 18), porcelain);
    handle.position.set(x + 0.09, COUNTER.top + 0.1, z); handle.rotation.y = Math.PI / 2; scene.add(handle);
  }
  cylinder(GFX, scene, 5.65, COUNTER.top + 0.13, -5.45, 0.105, 0.105, 0.22, new GFX.MeshStandardMaterial({ color: '#d87927', roughness: 0.18 }), 24);
  box(GFX, scene, 4.45, COUNTER.top + 0.11, -5.45, 0.42, 0.18, 0.28, walnut);
  box(GFX, scene, 4.45, COUNTER.top + 0.22, -5.45, 0.34, 0.08, 0.22, brass);
  for (const [kind, x] of [['potato-scramble', 0.25], ['sunny', 2.8], ['omelette', 5.15]]) {
    const plate = createBreakfastPlate(GFX, kind);
    plate.position.set(x, COUNTER.top + 0.055, -5.45); plate.scale.setScalar(0.24); scene.add(plate);
  }
}

export function buildCafeKitchen(GFX, scene, mats) {
  const steel = new GFX.MeshStandardMaterial({ color: '#687a74', metalness: 0.48, roughness: 0.38 });
  const marble = new GFX.MeshStandardMaterial({ color: '#d7d1c3', roughness: 0.58 });
  const wood = new GFX.MeshStandardMaterial({ color: '#684a35', roughness: 0.84 });
  box(GFX, scene, -6.7, 0.46, -4.55, 3.65, 0.92, 0.84, wood);
  box(GFX, scene, -6.7, 0.94, -4.55, 3.75, 0.08, 0.94, marble);
  box(GFX, scene, -6.7, 1.06, -4.55, 1.2, 0.12, 0.96, steel);
  for (const x of [-7.9, -7.2, -6.5]) {
    cylinder(GFX, scene, x, 1.04, -4.55, 0.2, 0.2, 0.06, steel, 24);
    cylinder(GFX, scene, x, 1.077, -4.55, 0.11, 0.11, 0.014, mats.dark, 24);
  }
  const pan = buildPan(GFX); pan.scale.setScalar(0.09); pan.rotation.y = Math.PI / 2; pan.position.set(-7.25, 1.11, -4.55); scene.add(pan);
  box(GFX, scene, -6.7, 0.48, -2.72, 3.55, 0.96, 0.66, wood);
  box(GFX, scene, -6.7, 0.99, -2.72, 3.65, 0.08, 0.76, marble);
  box(GFX, scene, -6.7, 1.75, -3.05, 3.35, 0.08, 0.25, wood);
  box(GFX, scene, -6.7, 2.27, -3.05, 3.35, 0.08, 0.25, wood);
  for (const x of [-8.2, -5.2]) for (const y of [1.98, 2.5]) box(GFX, scene, x, y, -3.05, 0.06, 1.08, 0.06, wood);
  const props = [
    [GROCERIES.eggs, -8.0, 1.11, -2.72, 0.65], [GROCERIES.bread, -6.85, 1.09, -2.72, 0.68],
    [GROCERIES.butter, -5.85, 1.1, -2.72, 0.68], [GROCERIES.coffee, -5.55, 1.9, -3.0, 0.54], [GROCERIES.milk, -7.45, 1.9, -3.0, 0.56],
  ];
  for (const [definition, x, y, z, scale] of props) {
    const model = createStatic(GFX, definition, { detail: 0.62 }); model.position.set(x, y, z); model.scale.setScalar(scale); scene.add(model);
  }
}
