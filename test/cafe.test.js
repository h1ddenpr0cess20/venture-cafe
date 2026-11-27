import test from 'node:test';
import assert from 'node:assert/strict';
import { CAFE_MENU, CAFE_MENU_BY_ID } from '../src/menu.js';
import { CAFE_SEATS, CAFE_TABLES, CAFE_BAR_STOOLS, SEAT_TOP, TABLE_TOP, WORLD_SCALE } from '../src/layout.js';
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

test('the dining room has distinct guest seating across tables, booths and bar stools', () => {
  assert.equal(new Set(CAFE_SEATS.map((seat) => seat.style)).size, 3);
  assert.equal(CAFE_SEATS.filter((seat) => seat.style === 'chair').length, CAFE_TABLES.length * 2);
  assert.equal(CAFE_SEATS.filter((seat) => seat.style === 'stool').length, CAFE_BAR_STOOLS.length);
});

test('dining chairs face their matching tables and booth guests sit in the middle of the bench', () => {
  for (const seat of CAFE_SEATS.filter((candidate) => candidate.style === 'chair')) {
    const table = CAFE_TABLES.find((item) => item.id === seat.tableId);
    assert.equal(Math.sign(Math.sin(seat.yaw)), Math.sign(table.x - seat.x), `${seat.id} faces its table`);
  }
  const booths = CAFE_SEATS.filter((seat) => seat.style === 'booth');
  assert.equal(booths.length, 4);
  assert.ok(booths.every((seat) => Math.abs(seat.x - (-7.85)) < 1e-6));
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
