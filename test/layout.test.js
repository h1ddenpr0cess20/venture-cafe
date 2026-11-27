import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAFE_SEATS, CAFE_TABLES, CAFE_BOOTHS, CAFE_BAR_STOOLS, CAFE_FURNITURE,
  SIDEWALK_SPAWN, DOOR_IN, WAITER_HOME, KITCHEN_PASS, BOB_HOME, LOU_HOME, PLAYER_HOME, KITCHEN_FIXTURES, CAFE_SERVICE_STOPS, findWalkPath, navBlocked,
} from '../src/layout.js';
import * as layout from '../src/layout.js';

test('cafe includes a service bar, dining tables, booths and multiple seat types',()=>{
 assert.ok(CAFE_TABLES.length>=4);
 assert.ok(CAFE_BOOTHS.length>=2);
 assert.ok(CAFE_BAR_STOOLS.length>=4);
 assert.ok(CAFE_SEATS.length>=16);
 assert.equal(new Set(CAFE_SEATS.map(s=>s.id)).size,CAFE_SEATS.length);
 assert.ok(CAFE_FURNITURE.length>=CAFE_TABLES.length+CAFE_BOOTHS.length);
});
test('every table and booth guest position is clear and reachable from the entrance',()=>{
 assert.ok(findWalkPath(SIDEWALK_SPAWN,DOOR_IN,{strict:true}));
 for(const seat of CAFE_SEATS){
   assert.equal(navBlocked(seat.x,seat.z),false,`seat ${seat.id} is blocked`);
   assert.ok(findWalkPath(DOOR_IN,[seat.x,0,seat.z],{strict:true}),`seat ${seat.id} is unreachable`);
 }
});

test('the waiter has clear routes between the dining room, kitchen pass, tables and booths', () => {
  assert.equal(navBlocked(WAITER_HOME[0], WAITER_HOME[2]), false);
  assert.equal(navBlocked(KITCHEN_PASS[0], KITCHEN_PASS[2]), false);
  assert.ok(findWalkPath(WAITER_HOME, KITCHEN_PASS, { strict: true }), 'waiter can reach the kitchen pass');
  for (const stop of CAFE_SERVICE_STOPS) {
    assert.equal(navBlocked(stop.x, stop.z), false, `service point ${stop.id} is clear`);
    assert.ok(findWalkPath(WAITER_HOME, [stop.x, 0, stop.z], { strict: true }), `waiter can reach ${stop.id}`);
  }
});

test('every station is clear, and the owner, host and waiter can reach the kitchen doorway and Bob', () => {
  for (const [name, home] of Object.entries({ bob: BOB_HOME, lou: LOU_HOME, player: PLAYER_HOME })) assert.equal(navBlocked(home[0], home[2]), false, `${name}'s station is clear`);
  for (const [name, home] of Object.entries({ lou: LOU_HOME, player: PLAYER_HOME, bob: BOB_HOME })) assert.ok(findWalkPath(DOOR_IN, home, { strict: true }), `${name}'s station is reachable`);
  assert.ok(findWalkPath(WAITER_HOME, BOB_HOME, { strict: true }), 'the waiter can reach the pass and the cook');
});

test('the kitchen counters stay inside the kitchen and clear of its doorway', () => {
  const { KITCHEN } = layout;
  for (const [name, f] of Object.entries(KITCHEN_FIXTURES)) {
    assert.ok(f.x - f.w / 2 >= KITCHEN.minX - 0.06 && f.x + f.w / 2 <= KITCHEN.maxX + 0.06, `${name} is inside the kitchen along x`);
    assert.ok(f.z - f.d / 2 >= KITCHEN.minZ - 0.06 && f.z + f.d / 2 <= KITCHEN.maxZ, `${name} is inside the kitchen along z`);
  }
  const gap = [KITCHEN.doorX - KITCHEN.doorWidth / 2, KITCHEN.doorX + KITCHEN.doorWidth / 2];
  for (const name of ['passWest', 'passEast']) {
    const f = KITCHEN_FIXTURES[name];
    assert.ok(f.x + f.w / 2 <= gap[0] + 1e-6 || f.x - f.w / 2 >= gap[1] - 1e-6, `${name} leaves the doorway open`);
  }
});

test('the bar stools have a waiter stop of their own, and every seat has a stop to be served from', () => {
  for (const seat of CAFE_SEATS) {
    const stop = layout.serviceStopFor(seat);
    assert.ok(stop, `${seat.id} has a service stop`);
    assert.equal(navBlocked(stop.x, stop.z), false, `the stop for ${seat.id} is clear`);
    assert.ok(findWalkPath(WAITER_HOME, [stop.x, 0, stop.z], { strict: true }), `the waiter can reach the stop for ${seat.id}`);
  }
});
