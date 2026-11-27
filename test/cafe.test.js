import test from 'node:test';
import assert from 'node:assert/strict';
import { CAFE_MENU, CAFE_MENU_BY_ID } from '../src/menu.js';
import { CAFE_SEATS, CAFE_TABLES, CAFE_BOOTHS, CAFE_BAR_STOOLS, SEAT_TOP, TABLE_TOP, WORLD_SCALE, boothGeometry } from '../src/layout.js';
import { INGREDIENT_BY_ID, createGameState, openMenu, recipeCost } from '../src/sim.js';

test('breakfast menu covers eggs every way, an omelette, toast and drinks', () => {
  assert.equal(CAFE_MENU.length, 9);
  for (const id of ['scrambled-eggs', 'sunny-side-up', 'over-easy', 'french-omelette', 'diner-omelette', 'buttered-toast', 'coffee', 'orange-juice', 'potato-egg-scramble']) assert.ok(CAFE_MENU_BY_ID[id], id);
});

test('every recipe ingredient is a real ingredient, and every dish makes the cafe money', () => {
  for (const item of CAFE_MENU) {
    for (const id of Object.keys(item.ingredients)) assert.ok(INGREDIENT_BY_ID[id], `${item.id} needs ${id}`);
    assert.ok(recipeCost(item) > 0 && recipeCost(item) < item.price * 0.45, `${item.id} costs ${recipeCost(item)} to make and sells for ${item.price}`);
  }
});

test('the dining room has four-person square tables, two-sided booths and bar stools', () => {
  assert.equal(new Set(CAFE_SEATS.map((seat) => seat.style)).size, 3);
  for (const table of CAFE_TABLES) {
    assert.equal(table.w, table.d, `${table.id} is square`);
    assert.equal(CAFE_SEATS.filter((seat) => seat.tableId === table.id).length, 4, `${table.id} seats four`);
  }
  for (const booth of CAFE_BOOTHS) assert.equal(CAFE_SEATS.filter((seat) => seat.tableId === booth.id).length, 4, `${booth.id} seats four`);
  assert.equal(CAFE_SEATS.filter((seat) => seat.style === 'stool').length, CAFE_BAR_STOOLS.length);
});

test('every chair faces its table, and a booth has a bench on each side of its table', () => {
  for (const seat of CAFE_SEATS.filter((candidate) => candidate.style === 'chair')) {
    const table = CAFE_TABLES.find((item) => item.id === seat.tableId);
    const facing = [Math.sin(seat.yaw), Math.cos(seat.yaw)], toTable = [table.x - seat.x, table.z - seat.z];
    assert.ok(facing[0] * toTable[0] + facing[1] * toTable[1] > 0.5, `${seat.id} faces its table`);
  }
  for (const booth of CAFE_BOOTHS) {
    const g = boothGeometry(booth);
    const seats = CAFE_SEATS.filter((seat) => seat.tableId === booth.id);
    const west = seats.filter((seat) => seat.x < g.tableX), east = seats.filter((seat) => seat.x > g.tableX);
    assert.equal(west.length, 2, `${booth.id} has two seats on the west bench`);
    assert.equal(east.length, 2, `${booth.id} has two seats on the east bench`);
    assert.ok(west.every((seat) => Math.sin(seat.yaw) > 0.9) && east.every((seat) => Math.sin(seat.yaw) < -0.9), 'each bench faces the table');
    assert.ok(west.every((seat) => Math.abs(seat.x - g.westX) < 1e-9) && east.every((seat) => Math.abs(seat.x - g.eastX) < 1e-9));
    assert.ok(g.wallX < g.westX && g.westX < g.tableX && g.tableX < g.eastX && g.eastX < g.eastWallX, 'back, bench, table, bench, back');
  }
});

test('furniture heights are the engine\'s real wood furniture at the world\'s scale', () => {
  assert.ok(Math.abs(SEAT_TOP - 0.47 * WORLD_SCALE) < 1e-9, 'the wood chair seat is 0.47 m');
  assert.ok(Math.abs(TABLE_TOP - 0.77 * WORLD_SCALE) < 1e-9, 'the wood dining table is 0.77 m');
  assert.ok(TABLE_TOP > SEAT_TOP + 0.2 && TABLE_TOP < SEAT_TOP + 0.3, 'a comfortable reach above the seat');
});

test('the opening cafe can serve its level-one menu from the walk-in', () => {
  const state = createGameState(7);
  const menu = openMenu(state);
  assert.ok(menu.length >= 5, 'a real opening menu');
  for (const item of menu) {
    for (const id of Object.keys(item.ingredients)) assert.ok(state.pantry[id].some((lot) => lot.qty > 0), `${item.id} has opening stock for ${id}`);
  }
});
