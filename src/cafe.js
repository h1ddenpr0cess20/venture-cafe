import { createEgg } from 'madness-engine/heroes/debater-egg/index';
import { createPotato } from 'madness-engine/heroes/tater/index';
import { buildPan } from 'madness-engine/props/pan/index';
import { createStatic } from 'madness-engine/models/model';
import { GROCERIES } from 'madness-engine/props/groceries';
import { CAFE_TABLES, CAFE_BOOTHS, CAFE_BAR_STOOLS } from './layout.js';
import { createBreakfastPlate } from './cafe-food.js';

function box(GFX, parent, x, y, z, w, h, d, material) {
  const mesh = new GFX.Mesh(new GFX.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function cylinder(GFX, parent, x, y, z, rt, rb, h, material, segments = 20) {
  const mesh = new GFX.Mesh(new GFX.CylinderGeometry(rt, rb, h, segments), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function freezeRig(rig) {
  const visit = (node) => {
    if (typeof node.onBeforeRender === 'function') node.onBeforeRender = null;
    for (const child of node.children ?? []) visit(child);
  };
  visit(rig.group);
  return rig.group;
}

export function buildCafeFurniture(GFX, scene) {
  const walnut = new GFX.MeshStandardMaterial({ color: '#60432f', roughness: 0.78 });
  const walnutLight = new GFX.MeshStandardMaterial({ color: '#9b704b', roughness: 0.7 });
  const brass = new GFX.MeshStandardMaterial({ color: '#b99a61', metalness: 0.58, roughness: 0.34 });
  const upholstery = new GFX.MeshStandardMaterial({ color: '#315b4c', roughness: 0.86 });
  const upholsteryLight = new GFX.MeshStandardMaterial({ color: '#547564', roughness: 0.88 });
  const porcelain = new GFX.MeshStandardMaterial({ color: '#f4eedf', roughness: 0.28 });

  // Four walnut two- and four-top tables with turned pedestal bases.
  for (const table of CAFE_TABLES) {
    cylinder(GFX, scene, table.x, 0.48, table.z, 0.12, 0.2, 0.82, brass, 18);
    box(GFX, scene, table.x, 0.94, table.z, table.w, 0.12, table.d, walnutLight);
    box(GFX, scene, table.x, 1.01, table.z, table.w - 0.12, 0.018, table.d - 0.12, walnut);
  }

  // Wall-side upholstered booths, with a little two-top table facing the bench.
  for (const booth of CAFE_BOOTHS) {
    box(GFX, scene, booth.x, 0.36, booth.z, 1.18, 0.68, booth.depth, walnut);
    box(GFX, scene, booth.x + 0.08, 0.76, booth.z, 1.0, 0.16, booth.depth - 0.12, upholsteryLight);
    box(GFX, scene, booth.x - 0.52, 1.22, booth.z, 0.16, 1.15, booth.depth + 0.08, upholstery);
    for (const side of [-1, 1]) box(GFX, scene, booth.x - 0.39, 1.03, booth.z + side * (booth.depth / 2 - 0.08), 0.35, 0.8, 0.15, upholsteryLight);
    cylinder(GFX, scene, -5.85, 0.47, booth.z, 0.1, 0.14, 0.82, brass, 16);
    box(GFX, scene, -5.85, 0.94, booth.z, 1.1, 0.12, 1.05, walnutLight);
  }

  // Chairs; customers are lowered into the seat line and the table edge conceals their lower bodies.
  const chairSeats = CAFE_TABLES.flatMap((table) => [
    { x: table.x - 1.15, z: table.z },
    { x: table.x + 1.15, z: table.z },
  ]);
  for (const seat of chairSeats) {
    cylinder(GFX, scene, seat.x, 0.42, seat.z, 0.36, 0.36, 0.12, upholsteryLight, 24);
    box(GFX, scene, seat.x, 0.82, seat.z - 0.26, 0.62, 0.68, 0.1, walnut);
    for (const dx of [-0.24, 0.24]) for (const dz of [-0.22, 0.22]) box(GFX, scene, seat.x + dx, 0.22, seat.z + dz, 0.06, 0.44, 0.06, walnutLight);
  }

  // Bar stools along the customer-facing edge of the service counter.
  for (const seat of CAFE_BAR_STOOLS) {
    cylinder(GFX, scene, seat.x, 0.42, seat.z, 0.34, 0.34, 0.14, upholstery, 24);
    cylinder(GFX, scene, seat.x, 0.22, seat.z, 0.06, 0.09, 0.4, brass, 16);
    cylinder(GFX, scene, seat.x, 0.045, seat.z, 0.28, 0.28, 0.07, walnut, 24);
    cylinder(GFX, scene, seat.x, 0.7, seat.z - 0.22, 0.28, 0.28, 0.08, walnutLight, 20);
  }

  // Coffee, juice and toast service on the bar counter.
  const cupMat = new GFX.MeshStandardMaterial({ color: '#eee5d4', roughness: 0.23 });
  const coffee = new GFX.MeshStandardMaterial({ color: '#493326', roughness: 0.2 });
  for (const [x, z] of [[1.0,-5.25],[2.2,-5.25]]) {
    cylinder(GFX, scene, x, 1.29, z, 0.12, 0.1, 0.19, cupMat, 24);
    cylinder(GFX, scene, x, 1.39, z, 0.105, 0.105, 0.012, coffee, 24);
    const handle = new GFX.Mesh(new GFX.TorusGeometry(0.065, 0.014, 8, 18), porcelain);
    handle.position.set(x + 0.12, 1.32, z);
    handle.rotation.y = Math.PI / 2;
    scene.add(handle);
  }
  cylinder(GFX, scene, 5.4, 1.38, -5.25, 0.13, 0.13, 0.26, new GFX.MeshStandardMaterial({ color: '#d87927', roughness: 0.18 }), 24);
  box(GFX, scene, 4.65, 1.36, -5.25, 0.48, 0.22, 0.32, walnut);
  box(GFX, scene, 4.65, 1.5, -5.25, 0.38, 0.12, 0.25, brass);
  for (let i = 0; i < 2; i++) {
    box(GFX, scene, 6.2 + i * 0.18, 1.18, -5.15, 0.28, 0.06, 0.23, new GFX.MeshStandardMaterial({ color: '#c88b4e', roughness: 0.85 }));
    box(GFX, scene, 6.2 + i * 0.18, 1.215, -5.15, 0.24, 0.014, 0.19, new GFX.MeshStandardMaterial({ color: '#edcf8c', roughness: 0.92 }));
  }

  // Finished plates use the original Short Order cooked-egg solids.
  const dishes = [['potato-scramble',0.05,-4.93],['sunny',2.05,-4.93],['omelette',4.05,-4.93]];
  for (const [kind, x, z] of dishes) {
    const plate = createBreakfastPlate(GFX, kind);
    plate.position.set(x, 1.12, z);
    plate.scale.setScalar(0.56);
    scene.add(plate);
  }
}

export function buildCafeKitchen(GFX, scene, mats) {
  const steel = new GFX.MeshStandardMaterial({ color: '#687a74', metalness: 0.48, roughness: 0.38 });
  const marble = new GFX.MeshStandardMaterial({ color: '#d7d1c3', roughness: 0.58 });
  const wood = new GFX.MeshStandardMaterial({ color: '#684a35', roughness: 0.84 });

  // The former receiving room becomes the breakfast prep kitchen.
  box(GFX, scene, -6.7, 0.46, -4.55, 3.65, 0.92, 0.84, wood);
  box(GFX, scene, -6.7, 0.94, -4.55, 3.75, 0.08, 0.94, marble);
  box(GFX, scene, -6.7, 1.06, -4.55, 1.2, 0.12, 0.96, steel);
  for (const x of [-7.9, -7.2, -6.5]) {
    cylinder(GFX, scene, x, 1.04, -4.55, 0.2, 0.2, 0.06, steel, 24);
    cylinder(GFX, scene, x, 1.077, -4.55, 0.11, 0.11, 0.014, mats.dark, 24);
  }

  // The existing Madness Engine cast-iron skillet is the hero cooking tool.
  const pan = buildPan(GFX);
  pan.scale.setScalar(0.115);
  pan.position.set(-7.25, 1.12, -4.55);
  scene.add(pan);

  // Prep counter and shelves for the ingredients the breakfast menu uses.
  box(GFX, scene, -6.7, 0.48, -2.72, 3.55, 0.96, 0.66, wood);
  box(GFX, scene, -6.7, 0.99, -2.72, 3.65, 0.08, 0.76, marble);
  box(GFX, scene, -6.7, 1.75, -3.05, 3.35, 0.08, 0.25, wood);
  box(GFX, scene, -6.7, 2.27, -3.05, 3.35, 0.08, 0.25, wood);
  for (const x of [-8.2, -5.2]) for (const y of [1.98, 2.5]) box(GFX, scene, x, y, -3.05, 0.06, 1.08, 0.06, wood);

  const props = [
    [GROCERIES.eggs, -8.0, 1.11, -2.72, 0.78],
    [GROCERIES.bread, -6.85, 1.09, -2.72, 0.8],
    [GROCERIES.butter, -5.85, 1.1, -2.72, 0.82],
    [GROCERIES.coffee, -5.55, 1.9, -3.0, 0.62],
    [GROCERIES.milk, -7.45, 1.9, -3.0, 0.68],
  ];
  for (const [definition, x, y, z, scale] of props) {
    const model = createStatic(GFX, definition, { detail: 0.7 });
    model.position.set(x, y, z);
    model.scale.setScalar(scale);
    scene.add(model);
  }
}

function mascotPlinth(GFX, scene, x, z, dark, brass) {
  cylinder(GFX, scene, x, 0.34, z, 0.66, 0.72, 0.68, dark, 32);
  cylinder(GFX, scene, x, 0.71, z, 0.75, 0.66, 0.12, brass, 32);
  cylinder(GFX, scene, x, 0.77, z, 0.58, 0.58, 0.02, dark, 32);
  box(GFX, scene, x, 0.42, z + 0.67, 0.78, 0.24, 0.055, dark);
  box(GFX, scene, x, 0.56, z + 0.70, 0.68, 0.018, 0.02, brass);
}
export function buildCafeMascots(GFX, scene) {
  const dark = new GFX.MeshStandardMaterial({ color: '#173b32', roughness: 0.74 });
  const brass = new GFX.MeshStandardMaterial({ color: '#c2a26a', metalness: 0.56, roughness: 0.38 });

  // Intact Debater Egg hero statue to the left of the storefront door.
  mascotPlinth(GFX, scene, 0.15, 8.45, dark, brass);
  const egg = createEgg({ GFX });
  freezeRig(egg);
  egg.group.scale.setScalar(1.08);
  egg.group.position.set(0.15, 0.79, 8.45);
  scene.add(egg.group);

  // Tater hero statue on the opposite side of the same entrance.
  mascotPlinth(GFX, scene, 4.65, 8.45, dark, brass);
  const tater = createPotato({ GFX });
  freezeRig(tater);
  tater.group.scale.setScalar(1.08);
  tater.group.position.set(4.65, 0.82, 8.45);
  scene.add(tater.group);
}
