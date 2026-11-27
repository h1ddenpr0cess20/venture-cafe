/**
 * Everyone in the cafe is a person from the engine's `createHuman`: a real-size body with its own build, skin,
 * hair, eyes and clothes, brought down to the world's WORLD_SCALE. The crew and the owner are dressed here; the
 * regulars are described in residents.js.
 *
 * A human is posed on the CPU, so a person is only re-posed as often as it can be seen to change: a walker every
 * frame or two, someone sitting or standing still a few times a second.
 */
import { createHuman } from 'madness-engine/people';
import { RESIDENT_BY_ID } from './residents.js';
import { WORLD_SCALE } from './layout.js';

const kit = (...worn) => ['briefs', 'socks', ...worn];

/** The crew and the owner. Colors are the human's `look` keys: poplin and wool are shirt and trousers cloth, tie, cap and knit. */
export const CREW = {
  'staff:lou': {
    sex: 'male', features: { build: 'average', height: 0.15 }, hair: 'sidePart', beard: 'stubble',
    look: { skin: '#d9a77d', iris: '#3d3028', hair: '#2b1d14', poplin: '#f2efe6', wool: '#3a2f2a', tie: '#7a2433', dressShoe: '#1a120d' },
    outfit: kit('dressShirt', 'tie', 'trousers', 'dressBelt', 'dressShoes'),
  },
  'staff:bob': {
    sex: 'male', features: { build: 'stocky', height: 0.05 }, hair: 'buzz', beard: 'goatee',
    look: { skin: '#c68e63', iris: '#3d3028', hair: '#241810', shirt: '#f3f1ea', wool: '#2f3438', cap: '#f4f1ea', shoe: '#2a2a2e' },
    outfit: kit('tshirt', 'trousers', 'sneakers', 'cap'),
  },
  'staff:waiter': {
    sex: 'male', features: { build: 'slim', height: 0.2 }, hair: 'slickBack',
    look: { skin: '#e6bf9d', iris: '#4a3a2a', hair: '#1c140f', poplin: '#1e2228', wool: '#1b1d22', dressShoe: '#100c09' },
    outfit: kit('dressShirt', 'trousers', 'dressBelt', 'dressShoes'),
  },
  owner: {
    sex: 'male', features: { build: 'average' }, hair: 'texturedCrop',
    look: { skin: '#d5a17f', iris: '#3d3028', hair: '#30231c', knit: '#72907d', denim: '#c9d3e0', boot: '#49413a' },
    outfit: kit('tshirt', 'jeans', 'boots', 'sweater'),
  },
};

/** How finely each kind of person is built. A person is about 27k triangles below 0.8 and four times that at 1. */
export const DETAIL = { owner: 0.8, staff: 0.75, resident: 0.6 };
export const detailOf = (name) => DETAIL[name.split(':')[0]] ?? 0.6;

/** What a name (`staff:bob`, `owner`, `resident:russo`) is built from. */
export function specOf(name) {
  if (CREW[name]) return CREW[name];
  const resident = RESIDENT_BY_ID[name.replace('resident:', '')];
  if (!resident) throw new Error(`people: nobody called "${name}"`);
  return resident;
}

/** The regulars who come in on the first morning; the rest are built while the cafe is open. */
export const FIRST_WAVE = ['russo', 'walt', 'priya', 'ari'];

/** Build one person. The result is { group, pose(spec), human }: the group is at the floor and WORLD_SCALE tall. */
export function buildPerson(GFX, name, detail = detailOf(name)) {
  const spec = specOf(name);
  const human = createHuman(GFX, {
    sex: spec.sex, detail, outfit: spec.outfit, look: spec.look, features: spec.features,
    hair: spec.hair, ...(spec.beard ? { beard: spec.beard } : {}),
  });
  human.group.scale.setScalar(WORLD_SCALE);
  let last = -Infinity, lastClip = null;
  return {
    group: human.group,
    human,
    /** Pose the person; `pace` is the engine's `speed`. Skipped when it was posed a moment ago and nothing about it has changed. */
    pose({ clip, t, time, seed = 0, pace = 1 }) {
      const interval = clip === 'walk' || clip === 'run' ? 0.05 : clip === 'sit' && t < 0.45 ? 0.05 : 0.16;
      if (clip === lastClip && time - last < interval) return;
      last = time; lastClip = clip;
      human.pose({ clip, t, time, seed, speed: pace });
    },
  };
}
