import test from 'node:test';
import assert from 'node:assert/strict';
import { CAFE_MENU, CAFE_MENU_BY_ID } from '../src/menu.js';
import { CAFE_SEATS, CAFE_TABLES, CAFE_BOOTHS, CAFE_BAR_STOOLS } from '../src/layout.js';
import { PRODUCT_BY_ID, createGameState, isAvailable } from '../src/sim.js';

test('breakfast menu covers all six Short Order egg preparations and cafe staples',()=>{
 for(const id of ['potato-egg-scramble','scrambled-eggs','sunny-side-up','over-easy','french-omelette','diner-omelette','buttered-toast','coffee','orange-juice']) assert.ok(CAFE_MENU_BY_ID[id],`missing ${id}`);
 assert.ok(CAFE_MENU.every(item=>item.price>0&&item.description&&item.prep));
});
test('dining room has distinct guest seating across tables, booths and bar stools',()=>{
 assert.ok(CAFE_TABLES.length>=4&&CAFE_BOOTHS.length>=2&&CAFE_BAR_STOOLS.length>=4);
 assert.equal(new Set(CAFE_SEATS.map(s=>s.id)).size,CAFE_SEATS.length);
});


test('recipe ingredients exist in the kitchen catalogue', () => {
 for (const item of CAFE_MENU) {
   assert.ok(Object.keys(item.ingredients).length > 0, `${item.id} has a recipe`);
   for (const productId of Object.keys(item.ingredients)) {
     assert.ok(PRODUCT_BY_ID[productId], `${item.id} ingredient ${productId} exists`);
     assert.ok(item.ingredients[productId] > 0);
   }
 }
});

test('dining chairs face their matching tables and booths provide correctly placed seats', () => {
 const chairs = CAFE_SEATS.filter(seat => seat.style === 'chair');
 assert.equal(chairs.length, CAFE_TABLES.length * 2);
 for (const seat of chairs) {
   const table = CAFE_TABLES.find(item => item.id === seat.tableId);
   assert.ok(table);
   assert.equal(Math.sign(Math.sin(seat.yaw)), Math.sign(table.x - seat.x), `${seat.id} faces its table`);
 }
 const booths = CAFE_SEATS.filter(seat => seat.style === 'booth');
 assert.equal(booths.length, 4);
 assert.ok(booths.every(seat => Math.abs(seat.x - (-7.55)) < 1e-6), 'guests sit in the centre of the bench cushion, clear of the back');
});


test('the opening cafe can serve breakfast with its day-one ingredient range', () => {
 const state = createGameState(7);
 const unlocked = CAFE_MENU.filter(item => Object.keys(item.ingredients).every(id => isAvailable(state, id)));
 assert.equal(unlocked.length, CAFE_MENU.length, 'the full breakfast menu is available on day one');
 assert.ok(unlocked.some(item => item.id === 'scrambled-eggs'));
 assert.ok(unlocked.some(item => item.id === 'sunny-side-up'));
 for (const item of unlocked) {
   for (const id of Object.keys(item.ingredients)) {
     assert.ok((state.shelves[id] ?? []).some(batch => batch.qty > 0), `${item.id} has opening stock for ${id}`);
   }
 }
});
