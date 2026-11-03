import { buildPan } from 'madness-engine/props/pan/index';
import { createStatic } from 'madness-engine/models/model';
import { GROCERIES } from 'madness-engine/props/groceries';
import { CAFE } from 'madness-engine/props/cafe';
import { COUNTER, CAFE_TABLES, CAFE_BOOTHS, CAFE_BAR_STOOLS, CAFE_SEATS, SEAT_TOP } from './layout.js';
import { createBreakfastPlate } from './cafe-food.js';

function box(GFX, parent, x, y, z, w, h, d, material) {
  const mesh = new GFX.Mesh(new GFX.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function cylinder(GFX, parent, x, y, z, rt, rb, h, material, segments = 24) {
  const mesh = new GFX.Mesh(new GFX.CylinderGeometry(rt, rb, h, segments), material);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

// The engine's café furniture is built for a seat 0.14 up; the cafe's seats are SEAT_TOP up.
const FURNITURE_SCALE = SEAT_TOP / 0.14;

export function buildCafeFurniture(GFX, scene) {
  const walnut = new GFX.MeshStandardMaterial({ color: '#60432f', roughness: 0.78 });
  const brass = new GFX.MeshStandardMaterial({ color: '#b99a61', metalness: 0.58, roughness: 0.34 });
  const porcelain = new GFX.MeshStandardMaterial({ color: '#f4eedf', roughness: 0.28 });
  // The dining furniture is the engine's own (`props/cafe`), made for a seat 0.14 up and brought up to ours.
  const furniture = (definition, x, z, yaw = 0) => {
    const piece = createStatic(GFX, definition, { detail: 0.8 });
    piece.scale.setScalar(FURNITURE_SCALE);
    piece.position.set(x, 0, z); piece.rotation.y = yaw; scene.add(piece);
    return piece;
  };
  for (const table of CAFE_TABLES) furniture(CAFE.cafetable, table.x, table.z);
  // A booth's bench runs along z with its back to the west wall; the engine's booth faces +z, so turn it to face +x.
  for (const booth of CAFE_BOOTHS) furniture(CAFE.cafebooth, booth.x, booth.z, Math.PI / 2);
  for (const seat of CAFE_SEATS.filter((candidate) => candidate.style === 'chair')) furniture(CAFE.cafechair, seat.x, seat.z, seat.yaw);
  for (const seat of CAFE_BAR_STOOLS) furniture(CAFE.cafestool, seat.x, seat.z);
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
