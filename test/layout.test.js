import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAFE_SEATS, CAFE_TABLES, CAFE_BOOTHS, CAFE_BAR_STOOLS, CAFE_FURNITURE,
  SIDEWALK_SPAWN, DOOR_IN, findWalkPath, navBlocked,
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
