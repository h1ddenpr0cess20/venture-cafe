import test from 'node:test';
import assert from 'node:assert/strict';
import { garmentsFor, HAIRSTYLES, BEARDS } from 'madness-engine/people';
import { CREW, FIRST_WAVE, DETAIL, specOf, detailOf } from '../src/people.js';
import { RESIDENTS, RESIDENT_BY_ID } from '../src/residents.js';
import { CAFE_MENU_BY_ID } from '../src/menu.js';

const everyone = [...Object.keys(CREW), ...RESIDENTS.map((resident) => `resident:${resident.id}`)];
const HEX = /^#[0-9a-f]{6}$/i;

test('everyone in the cafe is described to the engine\'s createHuman', () => {
  for (const name of everyone) {
    const spec = specOf(name);
    assert.ok(['male', 'female'].includes(spec.sex), `${name} is a figure`);
    const wardrobe = garmentsFor(spec.sex);
    for (const garment of spec.outfit) assert.ok(garment in wardrobe, `${name} wears a ${garment} that exists for ${spec.sex}`);
    assert.ok(spec.outfit.includes('briefs') && spec.outfit.some((g) => ['sneakers', 'boots', 'dressShoes'].includes(g)), `${name} is dressed from the skin out and wears shoes`);
    if (spec.hair) assert.ok(spec.hair in HAIRSTYLES, `${name}'s ${spec.hair} haircut exists`);
    if (spec.beard) { assert.equal(spec.sex, 'male'); assert.ok(spec.beard in BEARDS, `${name}'s ${spec.beard} beard exists`); }
    for (const [key, value] of Object.entries(spec.look)) assert.match(value, HEX, `${name}'s ${key} is a color`);
  }
});

test('the regulars are a varied neighborhood with valid habits', () => {
  assert.equal(new Set(RESIDENTS.map((r) => r.id)).size, RESIDENTS.length);
  assert.ok(RESIDENTS.length >= 12);
  assert.ok(RESIDENTS.some((r) => r.sex === 'female') && RESIDENTS.some((r) => r.sex === 'male'));
  assert.ok(new Set(RESIDENTS.map((r) => r.look.skin)).size >= 8, 'a range of skin tones');
  assert.ok(new Set(RESIDENTS.map((r) => r.hair)).size >= 10, 'a range of haircuts');
  for (const r of RESIDENTS) {
    assert.ok(r.likes.length >= 2 && r.likes.every((id) => CAFE_MENU_BY_ID[id]), `${r.id} likes real dishes`);
    assert.ok(r.thrift > 0 && r.thrift <= 1);
    assert.ok(r.peak[0] < r.peak[1] && r.peak[0] >= 0 && r.peak[1] <= 24);
    assert.equal(RESIDENT_BY_ID[r.id], r);
  }
});

test('the first wave is a subset of the regulars and detail grows with a person\'s importance', () => {
  assert.ok(FIRST_WAVE.length >= 3 && FIRST_WAVE.every((id) => RESIDENT_BY_ID[id]));
  assert.ok(DETAIL.owner >= DETAIL.staff && DETAIL.staff >= DETAIL.resident);
  assert.equal(detailOf('resident:russo'), DETAIL.resident);
  assert.equal(detailOf('staff:bob'), DETAIL.staff);
  assert.throws(() => specOf('resident:nobody'), /nobody/);
});
