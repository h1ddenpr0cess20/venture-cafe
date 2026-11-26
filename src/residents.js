/**
 * The neighborhood regulars. Each is a person built with the engine's `createHuman` (see people.js): a figure,
 * a build, skin, hair, eyes and an outfit of their own. The rest is what makes a diner a regular:
 *   - `likes`: menu items they tend to order (they weigh three times the rest),
 *   - `thrift`: the markup over the menu price they will pay before they call the place pricey,
 *   - `peak`: the hours of the day they usually come in.
 */

/** The clothes under everything, then what is worn over them. */
const kit = (sex, ...worn) => ['briefs', ...(sex === 'female' ? ['bra'] : []), 'socks', ...worn];

export const RESIDENTS = [
  { id: 'maya', name: 'Maya', full: 'Maya Okafor', tag: 'weekend visitor', sex: 'female', features: { build: 'slim', height: 0.2 },
    look: { skin: '#6f4120', iris: '#2a1a10', hair: '#0e0a08', tank: '#e8d9b0', cap: '#2f6b57' }, hair: 'curly',
    outfit: kit('female', 'tank', 'shorts', 'sneakers', 'cap'), likes: ['sunny-side-up', 'orange-juice'], thrift: 0.35, peak: [9, 13] },
  { id: 'rico', name: 'Rico', full: 'Rico Alvarez', tag: 'regular', sex: 'male', features: { build: 'athletic', height: 0.1 },
    look: { skin: '#c68642', iris: '#4a2e18', hair: '#0e0a08', hoodie: '#5b3a2e' }, hair: 'texturedCrop', beard: 'stubble',
    outfit: kit('male', 'tshirt', 'jeans', 'sneakers', 'hoodie'), likes: ['diner-omelette', 'coffee'], thrift: 0.3, peak: [7, 10] },
  { id: 'sunny', name: 'Sunny', full: 'Sunny Park', tag: 'brunch regular', sex: 'female', features: { build: 'average', height: -0.1 },
    look: { skin: '#f0d0c0', iris: '#2a1a10', hair: '#241810', shirt: '#9db58c' }, hair: 'longBangs',
    outfit: kit('female', 'tshirt', 'skirt', 'sneakers'), likes: ['potato-egg-scramble', 'orange-juice'], thrift: 0.4, peak: [9, 13] },
  { id: 'theo', name: 'Theo', full: 'Theo Laurent', tag: 'local artist', sex: 'male', features: { build: 'slim', height: 0.3 },
    look: { skin: '#8d5524', iris: '#2a1a10', hair: '#0e0a08', knit: '#c0873f' }, hair: 'afro', beard: 'goatee',
    outfit: kit('male', 'tshirt', 'jeans', 'boots', 'sweater'), likes: ['french-omelette', 'coffee', 'buttered-toast'], thrift: 0.3, peak: [9, 14] },
  { id: 'ari', name: 'Ari', full: 'Ari Cohen', tag: 'coffee regular', sex: 'male', features: { build: 'average' },
    look: { skin: '#f6dcc8', iris: '#5a86b0', hair: '#8a3a1e', denim: '#e6edf7' }, hair: 'crew', beard: 'full',
    outfit: kit('male', 'tshirt', 'jeans', 'sneakers', 'denimJacket'), likes: ['coffee', 'scrambled-eggs'], thrift: 0.55, peak: [7, 10] },
  { id: 'sal', name: 'Sal', full: 'Sal Haddad', tag: 'night-shift driver', sex: 'male', features: { build: 'stocky' },
    look: { skin: '#d19a6a', iris: '#4a2e18', hair: '#241810', poplin: '#c9d6e4', wool: '#3a3f4a' }, hair: 'slickBack', beard: 'chevron',
    outfit: kit('male', 'dressShirt', 'trousers', 'dressShoes'), likes: ['coffee', 'over-easy'], thrift: 0.3, peak: [7, 9] },
  { id: 'russo', name: 'Mrs. Russo', full: 'Rosa Russo', tag: 'neighbor', sex: 'female', features: { build: 'stocky', height: -0.5 },
    look: { skin: '#f0d0c0', iris: '#6a7a8a', hair: '#e8e6e0', knit: '#7a4a62' }, hair: 'bob',
    outfit: kit('female', 'tshirt', 'skirt', 'dressShoes', 'sweater'), likes: ['french-omelette', 'buttered-toast', 'coffee'], thrift: 0.2, peak: [8, 11] },
  { id: 'dwayne', name: 'Dwayne', full: 'Dwayne Brooks', tag: 'after-shift regular', sex: 'male', features: { build: 'stocky', height: 0.2 },
    look: { skin: '#533018', iris: '#2a1a10', hair: '#0e0a08', shirt: '#3d5f73' }, hair: 'buzz', beard: 'full',
    outfit: kit('male', 'tshirt', 'jeans', 'boots'), likes: ['diner-omelette', 'potato-egg-scramble'], thrift: 0.35, peak: [7, 10] },
  { id: 'kenji', name: 'Kenji', full: 'Kenji Watanabe', tag: 'commuter', sex: 'male', features: { build: 'slim' },
    look: { skin: '#f0d0c0', iris: '#2a1a10', hair: '#0e0a08', wool: '#2b3140', poplin: '#f2f3f6', tie: '#2f5d8a' }, hair: 'sidePart',
    outfit: kit('male', 'dressShirt', 'tie', 'trousers', 'dressShoes', 'blazer'), likes: ['coffee', 'buttered-toast'], thrift: 0.6, peak: [7, 9] },
  { id: 'luis', name: 'Luis', full: 'Luis Ortega', tag: 'mail carrier', sex: 'male', features: { build: 'athletic' },
    look: { skin: '#c68642', iris: '#4a2e18', hair: '#241810', shirt: '#3b5c8a', cap: '#3b5c8a' }, hair: 'caesar',
    outfit: kit('male', 'tshirt', 'shorts', 'boots', 'cap'), likes: ['sunny-side-up', 'coffee', 'buttered-toast'], thrift: 0.35, peak: [10, 13] },
  { id: 'priya', name: 'Priya', full: 'Priya Nair', tag: 'weekly regular', sex: 'female', features: { build: 'average', height: 0.05 },
    look: { skin: '#a9703f', iris: '#2a1a10', hair: '#0e0a08', knit: '#3d6f6a' }, hair: 'long',
    outfit: kit('female', 'tshirt', 'jeans', 'sneakers', 'sweater'), likes: ['scrambled-eggs', 'orange-juice', 'buttered-toast'], thrift: 0.45, peak: [9, 13] },
  { id: 'walt', name: 'Walt', full: 'Walter Jenkins', tag: 'been coming here forever', sex: 'male', features: { build: 'average', height: -0.2 },
    look: { skin: '#3b2314', iris: '#4a2e18', hair: '#9a9a9a', knit: '#6e5d49', felt: '#4b4036' }, hair: 'balding', beard: 'stubble',
    outfit: kit('male', 'tshirt', 'trousers', 'dressShoes', 'sweater', 'fedora'), likes: ['sunny-side-up', 'coffee', 'buttered-toast'], thrift: 0.15, peak: [7, 10] },
  { id: 'camille', name: 'Camille', full: 'Camille Dubois', tag: 'barista off shift', sex: 'female', features: { build: 'slim', height: 0.1 },
    look: { skin: '#533018', iris: '#2a1a10', hair: '#0e0a08', denim: '#d9e0ea', beanie: '#b54b3a' }, hair: 'pixie',
    outfit: kit('female', 'tshirt', 'jeans', 'boots', 'denimJacket', 'beanie'), likes: ['coffee', 'french-omelette'], thrift: 0.35, peak: [13, 17] },
  { id: 'zoe', name: 'Zoe', full: 'Zoe Tran', tag: 'wellness blogger', sex: 'female', features: { build: 'slim' },
    look: { skin: '#f0d0c0', iris: '#2a1a10', hair: '#0e0a08', tank: '#bcd8c8' }, hair: 'ponytail',
    outfit: kit('female', 'tank', 'miniSkirt', 'sneakers'), likes: ['orange-juice', 'scrambled-eggs'], thrift: 0.8, peak: [10, 15] },
  { id: 'dmitri', name: 'Dmitri', full: 'Dmitri Volkov', tag: 'warehouse foreman', sex: 'male', features: { build: 'heavy', height: 0.25 },
    look: { skin: '#f6dcc8', iris: '#6a6a2a', hair: '#7a5230', hoodie: '#4c5a40' }, hair: 'flatTop', beard: 'walrus',
    outfit: kit('male', 'tshirt', 'jeans', 'boots', 'hoodie'), likes: ['potato-egg-scramble', 'diner-omelette'], thrift: 0.25, peak: [6, 9] },
];
export const RESIDENT_BY_ID = Object.fromEntries(RESIDENTS.map((resident) => [resident.id, resident]));
