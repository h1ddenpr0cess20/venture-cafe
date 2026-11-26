import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAFE_SEATS, CAFE_TABLES, CAFE_BOOTHS, CAFE_BAR_STOOLS, CAFE_FURNITURE,
  SIDEWALK_SPAWN, DOOR_IN, WAITER_HOME, KITCHEN_PASS, BOB_HOME, LOU_HOME, PLAYER_HOME, KITCHEN_FIXTURES, CAFE_SERVICE_STOPS, findWalkPath, navBlocked,
} from '../src/layout.js';

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

test('every station is clear, the owner and host can be reached, and the kitchen counters stand clear of each other', () => {
  for (const [name, home] of Object.entries({ bob: BOB_HOME, lou: LOU_HOME, player: PLAYER_HOME })) assert.equal(navBlocked(home[0], home[2]), false, `${name}'s station is clear`);
  for (const [name, home] of Object.entries({ lou: LOU_HOME, player: PLAYER_HOME })) assert.ok(findWalkPath(DOOR_IN, home, { strict: true }), `${name}'s station is reachable`);
  const { prep, pass } = KITCHEN_FIXTURES;
  assert.ok(Math.abs(prep.z - pass.z) > (prep.d + pass.d) / 2, 'a walkway between the prep counter and the pass');
});
