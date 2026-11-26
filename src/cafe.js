import { buildPan } from 'madness-engine/props/pan/index';
import { createWoodTable } from 'madness-engine/props/wood-table';
import { createWoodChair } from 'madness-engine/props/wood-chair';
import { createWoodBoard } from 'madness-engine/props/wood-board';
import { createBookcase, woodMaterial, woodUV } from 'madness-engine/props/bookcase';
import { COUNTER, BACKBAR, CAFE_TABLES, CAFE_BOOTHS, CAFE_BAR_STOOLS, CAFE_SEATS, WORLD_SCALE, SEAT_TOP, TABLE_TOP } from './layout.js';
import { createBreakfastPlate } from './cafe-food.js';

/** The cafe's wood: walnut for the furniture and the bar, in the engine's lacquer. */
const SPECIES = 'walnut';
const FINISH = 'lacquered';

function box(GFX, parent, x, y, z, w, h, d, material) {
  const mesh = new GFX.Mesh(new GFX.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function cylinder(GFX, parent, x, y, z, rt, rb, h, material, segments = 24) {
  const mesh = new GFX.Mesh(new GFX.CylinderGeometry(rt, rb, h, segments), material);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
/** A box of the engine's wood with its grain running along `grain` ('x', 'y' or 'z') in world space. */
function lumber(GFX, parent, material, x, y, z, w, h, d, grain = 'x') {
  const geometry = new GFX.BoxGeometry(w, h, d);
  woodUV(GFX, geometry, [x, y, z], grain);
  const mesh = new GFX.Mesh(geometry, material);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

/** The engine's wood furniture is real size; the cafe's people and rooms are WORLD_SCALE of it. */
function furniture(scene, object, x, z, yaw = 0) {
  object.scale.setScalar(WORLD_SCALE);
  object.position.set(x, 0, z); object.rotation.y = yaw; scene.add(object);
  return object;
}

export function buildCafeFurniture(GFX, scene) {
  const wood = woodMaterial(GFX, SPECIES, FINISH);
  const woodRaw = woodMaterial(GFX, SPECIES, 'sanded');
  const brass = new GFX.MeshStandardMaterial({ color: '#b99a61', metalness: 0.58, roughness: 0.34 });
  const porcelain = new GFX.MeshStandardMaterial({ color: '#f4eedf', roughness: 0.28 });
  const cushion = new GFX.MeshStandardMaterial({ color: '#315b4c', roughness: 0.88 });

  // Dining tables: walnut, turned legs, sized for the cafe's two-person tables.
  for (const table of CAFE_TABLES) {
    const made = createWoodTable(GFX, { kind: 'dining', species: SPECIES, finish: FINISH, legs: 'turned', width: table.w / WORLD_SCALE, depth: table.d / WORLD_SCALE });
    furniture(scene, made.group, table.x, table.z);
  }
  for (const seat of CAFE_SEATS.filter((candidate) => candidate.style === 'chair')) {
    furniture(scene, createWoodChair(GFX, { kind: 'dining', species: SPECIES, finish: FINISH, seed: Math.round(seat.x * 7 + seat.z * 13) }).group, seat.x, seat.z, seat.yaw);
  }
  for (const seat of CAFE_BAR_STOOLS) {
    furniture(scene, createWoodChair(GFX, { kind: 'barstool', species: SPECIES, finish: FINISH, seed: Math.round(seat.x * 11) }).group, seat.x, seat.z, seat.yaw);
  }

  // Booths: a walnut bench with a high back against the west wall and a table in front of it.
  for (const booth of CAFE_BOOTHS) {
    const wallX = booth.x - 0.67, benchX = wallX + 0.4;
    lumber(GFX, scene, wood, wallX + 0.03, 0.62, booth.z, 0.06, 1.24, booth.depth, 'z');                       // the back
    lumber(GFX, scene, woodRaw, benchX + 0.02, SEAT_TOP / 2 - 0.02, booth.z, 0.74, SEAT_TOP - 0.04, booth.depth - 0.04, 'z'); // the base
    box(GFX, scene, benchX, SEAT_TOP - 0.01, booth.z, 0.64, 0.06, booth.depth - 0.12, cushion);                  // the seat cushion
    box(GFX, scene, wallX + 0.1, 0.78, booth.z, 0.1, 0.46, booth.depth - 0.16, cushion);                         // the back cushion
    lumber(GFX, scene, wood, wallX + 0.35, 1.26, booth.z, 0.7, 0.05, booth.depth, 'z');                        // the cap rail
    const made = createWoodTable(GFX, { kind: 'dining', species: SPECIES, finish: FINISH, legs: 'turned', width: (booth.depth - 0.1) / WORLD_SCALE, depth: 0.7 / WORLD_SCALE });
    furniture(scene, made.group, wallX + 1.5, booth.z, Math.PI / 2);
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
  box(GFX, scene, 4.45, COUNTER.top + 0.11, -5.45, 0.42, 0.18, 0.28, woodRaw);
  box(GFX, scene, 4.45, COUNTER.top + 0.22, -5.45, 0.34, 0.08, 0.22, brass);
  for (const [kind, x] of [['potato-scramble', 0.25], ['sunny', 2.8], ['omelette', 5.15]]) {
    const plate = createBreakfastPlate(GFX, kind);
    plate.position.set(x, COUNTER.top + 0.055, -5.45); plate.scale.setScalar(0.24); scene.add(plate);
  }
}

/** The long service bar: a carcass with raised walnut panels on the dining side and a lacquered walnut top. */
export function buildCafeBar(GFX, scene, mats) {
  const wood = woodMaterial(GFX, SPECIES, FINISH);
  const panel = woodMaterial(GFX, SPECIES, 'sanded');
  const { x, z, w, d, top } = COUNTER;
  box(GFX, scene, x, (top - 0.08) / 2, z, w - 0.1, top - 0.08, d - 0.1, mats.woodDark);
  lumber(GFX, scene, wood, x, top - 0.03, z, w + 0.14, 0.06, d + 0.16, 'x');
  // The front: panels between stiles, facing the dining room (+z).
  const count = Math.round(w / 0.95), pw = (w - 0.1) / count;
  for (let i = 0; i < count; i++) {
    const px = x - (w - 0.1) / 2 + pw * (i + 0.5);
    lumber(GFX, scene, panel, px, (top - 0.12) / 2 + 0.04, z + d / 2 - 0.02, pw - 0.1, top - 0.34, 0.035, 'y');
    lumber(GFX, scene, wood, px - pw / 2, (top - 0.1) / 2, z + d / 2 - 0.005, 0.06, top - 0.1, 0.05, 'y');
  }
  lumber(GFX, scene, wood, x + w / 2 - 0.03, (top - 0.1) / 2, z + d / 2 - 0.005, 0.06, top - 0.1, 0.05, 'y');
  box(GFX, scene, x, 0.07, z + d / 2 + 0.04, w + 0.04, 0.12, 0.06, mats.woodDark);                              // the kick
  box(GFX, scene, x, 0.2, z + d / 2 + 0.09, w - 0.1, 0.035, 0.06, new GFX.MeshStandardMaterial({ color: '#b99a61', metalness: 0.6, roughness: 0.32 })); // the brass foot rail
  // A small register.
  box(GFX, scene, x + 2.8, top + 0.13, z + 0.08, 0.42, 0.2, 0.34, mats.steelDark);
  box(GFX, scene, x + 2.8, top + 0.32, z + 0.08, 0.38, 0.2, 0.05, mats.dark);
  box(GFX, scene, x + 2.8, top + 0.33, z + 0.05, 0.31, 0.14, 0.018, mats.led, { castShadow: false });
}

/** The backbar: three tall walnut bookcases with cups, jars and tins on their shelves. */
export function buildCafeBackbar(GFX, scene) {
  const cup = new GFX.MeshStandardMaterial({ color: '#eee5d4', roughness: 0.23 });
  const tin = new GFX.MeshStandardMaterial({ color: '#7d5a3c', roughness: 0.4, metalness: 0.5 });
  const jar = new GFX.MeshStandardMaterial({ color: '#c9d9d4', roughness: 0.1, transparent: true, opacity: 0.55 });
  const mug = () => {
    const group = new GFX.Group();
    cylinder(GFX, group, 0, 0.045, 0, 0.04, 0.035, 0.09, cup, 18);
    const handle = new GFX.Mesh(new GFX.TorusGeometry(0.024, 0.008, 6, 14), cup); handle.position.set(0.045, 0.045, 0); group.add(handle);
    return group;
  };
  const canister = (material, h = 0.16, r = 0.05) => { const group = new GFX.Group(); cylinder(GFX, group, 0, h / 2, 0, r, r, h, material, 18); return group; };
  const widths = 2.4, count = 3;
  for (let i = 0; i < count; i++) {
    const made = createBookcase(GFX, { species: SPECIES, finish: FINISH, width: widths, height: 2.35, depth: 0.34, shelves: 4, seed: i + 3 });
    // The back of the cafe's service aisle: the cases face the dining room (+z).
    made.group.position.set(BACKBAR.x + (i - 1) * (widths + 0.05), 0, BACKBAR.z + 0.02);
    scene.add(made.group);
    for (let shelf = 0; shelf < 4; shelf++) {
      for (let k = 0; k < 6; k++) {
        const x = -0.95 + k * 0.38 + ((i + shelf) % 2) * 0.06;
        const pick = (k + shelf + i) % 3;
        made.place(pick === 0 ? mug() : pick === 1 ? canister(tin) : canister(jar, 0.2, 0.045), { compartment: shelf, x });
      }
    }
  }
}

export function buildCafeKitchen(GFX, scene, mats) {
  const steel = new GFX.MeshStandardMaterial({ color: '#687a74', metalness: 0.48, roughness: 0.38 });
  const marble = new GFX.MeshStandardMaterial({ color: '#d7d1c3', roughness: 0.58 });
  const wood = woodMaterial(GFX, SPECIES, FINISH);
  const carcass = woodMaterial(GFX, SPECIES, 'sanded');
  // The prep counter, with the cooktop and the cast-iron pan.
  lumber(GFX, scene, carcass, -6.7, 0.46, -4.55, 3.65, 0.92, 0.84, 'x');
  box(GFX, scene, -6.7, 0.94, -4.55, 3.75, 0.08, 0.94, marble);
  box(GFX, scene, -6.7, 1.06, -4.55, 1.2, 0.12, 0.96, steel);
  for (const x of [-7.9, -7.2, -6.5]) {
    cylinder(GFX, scene, x, 1.04, -4.55, 0.2, 0.2, 0.06, steel, 24);
    cylinder(GFX, scene, x, 1.077, -4.55, 0.11, 0.11, 0.014, mats.dark, 24);
  }
  const pan = buildPan(GFX); pan.scale.setScalar(0.09); pan.rotation.y = Math.PI / 2; pan.position.set(-7.25, 1.11, -4.55); scene.add(pan);
  // The pass: a counter between kitchen and dining room, with an open shelf over it.
  lumber(GFX, scene, carcass, -6.7, 0.48, -2.72, 3.55, 0.96, 0.66, 'x');
  box(GFX, scene, -6.7, 0.99, -2.72, 3.65, 0.08, 0.76, marble);
  lumber(GFX, scene, wood, -6.7, 1.75, -3.05, 3.35, 0.05, 0.25, 'x');
  lumber(GFX, scene, wood, -6.7, 2.27, -3.05, 3.35, 0.05, 0.25, 'x');
  for (const x of [-8.2, -5.2]) for (const y of [1.98, 2.5]) lumber(GFX, scene, wood, x, y, -3.05, 0.05, 1.08, 0.05, 'y');
  // On the shelves: crocks of utensils and a stack of plates, in place of shop stock.
  const crock = new GFX.MeshStandardMaterial({ color: '#b9724a', roughness: 0.6 });
  const plate = new GFX.MeshStandardMaterial({ color: '#f4eedf', roughness: 0.28 });
  for (const x of [-8.0, -7.5, -5.7]) cylinder(GFX, scene, x, 1.75 + 0.1, -3.05, 0.07, 0.065, 0.16, crock, 18);
  for (let i = 0; i < 7; i++) cylinder(GFX, scene, -6.7, 2.3 + i * 0.016, -3.05, 0.13, 0.12, 0.014, plate, 24);
  // A cutting board on the prep counter, from the engine's wood boards.
  const board = createWoodBoard(GFX, { species: 'walnut', finish: 'sanded', length: 0.6, width: 0.34, thickness: 0.04 });
  board.group.position.set(-5.5, 1.0, -4.55); scene.add(board.group);
}
