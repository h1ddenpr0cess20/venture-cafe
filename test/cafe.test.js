import test from 'node:test';
import assert from 'node:assert/strict';
import { CAFE_MENU, CAFE_MENU_BY_ID } from '../src/menu.js';
import { CAFE_SEATS, CAFE_TABLES, CAFE_BOOTHS, CAFE_BAR_STOOLS } from '../src/layout.js';

test('breakfast menu covers all six Short Order egg preparations and cafe staples',()=>{
 for(const id of ['potato-egg-scramble','scrambled-eggs','sunny-side-up','over-easy','french-omelette','diner-omelette','buttered-toast','coffee','orange-juice']) assert.ok(CAFE_MENU_BY_ID[id],`missing ${id}`);
 assert.ok(CAFE_MENU.every(item=>item.price>0&&item.description&&item.prep));
});
test('dining room has distinct guest seating across tables, booths and bar stools',()=>{
 assert.ok(CAFE_TABLES.length>=4&&CAFE_BOOTHS.length>=2&&CAFE_BAR_STOOLS.length>=4);
 assert.equal(new Set(CAFE_SEATS.map(s=>s.id)).size,CAFE_SEATS.length);
});
