import { PIECES, PIECE_BY_ID, isStanding, canPlace, placementProblem, CAFE_SEATS } from './layout.js';
import { CAFE_MENU, CAFE_MENU_BY_ID } from './menu.js';

/**
 * Venture Cafe's authoritative cafe simulation.
 * All dates are measured in fractional store-days. A batch's expiry is fixed
 * when it is received; moving it between the stockroom and shelf never resets it.
 */
export const PRODUCTS = [
  { id: 'apples', name: 'Gala apples', short: 'Apples', category: 'Produce', section: 'produce', cost: 0.48, price: 1.29, shelfLife: 8, caseSize: 12, demand: 1.25, color: '#d75c43', kind: 'produce', description: 'Crisp, sweet, one of the regulars.' },
  { id: 'bananas', name: 'Bananas', short: 'Bananas', category: 'Produce', section: 'produce', cost: 0.32, price: 0.89, shelfLife: 4, caseSize: 12, demand: 1.35, color: '#e6c84a', kind: 'produce', description: 'Best sellers. They turn fast.' },
  { id: 'tomatoes', name: 'Vine tomatoes', short: 'Tomatoes', category: 'Produce', section: 'produce', cost: 0.42, price: 1.19, shelfLife: 5, caseSize: 12, demand: 0.9, color: '#d94b39', kind: 'produce', description: 'Keep them out of the fridge.' },
  { id: 'lettuce', name: 'Green lettuce', short: 'Lettuce', category: 'Produce', section: 'produce', cost: 0.62, price: 1.69, shelfLife: 3, caseSize: 8, demand: 0.78, color: '#80a74f', kind: 'produce', description: 'The shortest clock in the produce crate.' },
  { id: 'potatoes', name: 'Russet potatoes', short: 'Potatoes', category: 'Produce', section: 'produce', cost: 0.24, price: 0.79, shelfLife: 18, caseSize: 12, demand: 0.85, color: '#a77b4f', kind: 'produce', description: 'A sturdy staple with a longer shelf life.' },
  { id: 'milk', name: 'Whole milk · 1 qt', short: 'Whole milk', category: 'Dairy', section: 'chilled', cost: 1.34, price: 2.79, shelfLife: 6, caseSize: 6, demand: 1.5, color: '#e5e1cf', kind: 'carton', description: 'Keep chilled. A neighborhood essential.' },
  { id: 'yogurt', name: 'Plain yogurt', short: 'Yogurt', category: 'Dairy', section: 'chilled', cost: 0.54, price: 1.29, shelfLife: 10, caseSize: 8, demand: 0.7, color: '#e8dfcc', kind: 'tub', description: 'A little more forgiving than milk.' },
  { id: 'cheese', name: 'Cheddar cheese', short: 'Cheddar', category: 'Dairy', section: 'chilled', cost: 1.55, price: 3.49, shelfLife: 24, caseSize: 6, demand: 0.72, color: '#e4a93d', kind: 'carton', description: 'Longer dated, still belongs in the cooler.' },
  { id: 'butter', name: 'Salted butter', short: 'Butter', category: 'Dairy', section: 'chilled', cost: 1.22, price: 2.79, shelfLife: 36, caseSize: 6, demand: 0.58, color: '#e8d58a', kind: 'carton', description: 'A slower-moving dairy line.' },
  { id: 'eggs', name: 'Large brown eggs · 6', short: 'Eggs', category: 'Eggs', section: 'chilled', cost: 1.28, price: 2.99, shelfLife: 28, caseSize: 6, demand: 1.05, color: '#c9a77a', kind: 'eggbox', description: 'Check the date and keep them cold.' },
  { id: 'bread', name: 'Fresh sandwich bread', short: 'Bread', category: 'Bakery', section: 'bakery', cost: 0.92, price: 2.29, shelfLife: 5, caseSize: 8, demand: 1.12, color: '#bd8950', kind: 'loaf', description: 'Delivered often. Stales quickly.' },
  { id: 'chicken', name: 'Chicken breast · 1 lb', short: 'Chicken', category: 'Meat', section: 'chilled', cost: 3.15, price: 6.49, shelfLife: 3, caseSize: 4, demand: 0.55, color: '#dfb49a', kind: 'tray', description: 'Short-dated fresh meat. Do not let it sit.' },
  { id: 'beef', name: 'Ground beef · 1 lb', short: 'Ground beef', category: 'Meat', section: 'chilled', cost: 2.8, price: 5.99, shelfLife: 4, caseSize: 4, demand: 0.58, color: '#ad5144', kind: 'tray', description: 'Keep cold; watch the sell-by date.' },
  { id: 'deli', name: 'Sliced turkey', short: 'Deli turkey', category: 'Meat', section: 'chilled', cost: 1.46, price: 3.49, shelfLife: 7, caseSize: 6, demand: 0.62, color: '#cf9b83', kind: 'tray', description: 'Refrigerated and moderately perishable.' },
  { id: 'rice', name: 'Long-grain rice · 2 lb', short: 'Rice', category: 'Dry goods', section: 'dry', cost: 1.2, price: 2.99, shelfLife: 240, caseSize: 8, demand: 0.85, color: '#e3d7b5', kind: 'bag', description: 'A long-dated pantry staple.' },
  { id: 'pasta', name: 'Spaghetti', short: 'Pasta', category: 'Dry goods', section: 'dry', cost: 0.62, price: 1.69, shelfLife: 240, caseSize: 12, demand: 1.0, color: '#e0c17e', kind: 'bag', description: 'High margin and easy to store.' },
  { id: 'cereal', name: 'Corn flakes', short: 'Cereal', category: 'Dry goods', section: 'dry', cost: 1.62, price: 3.79, shelfLife: 120, caseSize: 6, demand: 0.72, color: '#d7b45c', kind: 'box', description: 'Bulky but slow to expire.' },
  { id: 'beans', name: 'Black beans · can', short: 'Black beans', category: 'Dry goods', section: 'dry', cost: 0.48, price: 1.29, shelfLife: 540, caseSize: 12, demand: 1.05, color: '#5e6a55', kind: 'can', description: 'A very long-dated cupboard staple.' },
  { id: 'coffee', name: 'Ground coffee', short: 'Coffee', category: 'Dry goods', section: 'dry', cost: 2.35, price: 5.29, shelfLife: 180, caseSize: 6, demand: 0.92, color: '#81533d', kind: 'bag', description: 'Premium item with a healthy margin.' },
  { id: 'soda', name: 'Cola · 2 L', short: 'Cola', category: 'Drinks', section: 'drinks', cost: 0.78, price: 1.99, shelfLife: 180, caseSize: 8, demand: 1.42, color: '#8b3c35', kind: 'bottle', description: 'A reliable cooler-door impulse buy.' },
  { id: 'water', name: 'Spring water · 1 L', short: 'Water', category: 'Drinks', section: 'drinks', cost: 0.28, price: 0.99, shelfLife: 540, caseSize: 12, demand: 1.38, color: '#85b9cf', kind: 'bottle', description: 'Long dated, quick turnover.' },
  { id: 'pizza', name: 'Cheese pizza', short: 'Frozen pizza', category: 'Frozen', section: 'frozen', cost: 2.05, price: 4.99, shelfLife: 180, caseSize: 6, demand: 0.7, color: '#d8a75e', kind: 'frozen', description: 'Frozen stock is forgiving, not immortal.' },
  { id: 'icecream', name: 'Vanilla ice cream', short: 'Ice cream', category: 'Frozen', section: 'frozen', cost: 1.9, price: 4.79, shelfLife: 100, caseSize: 6, demand: 0.78, color: '#e7dfc9', kind: 'tub', description: 'Keep frozen. Watch freezer temperature.' },

  // ——— Tier 2 and 3: new lines that need the store's level and a fixture to put them on (see FIXTURES) ———
  { id: 'oranges', name: 'Navel oranges', short: 'Oranges', category: 'Produce', section: 'produce', cost: 0.52, price: 1.39, shelfLife: 10, caseSize: 12, demand: 0.95, color: '#e8861e', kind: 'produce', tier: 2, fixture: 'bin-1', description: 'Sweet, easy to peel and they hold up well.' },
  { id: 'carrots', name: 'Carrots · bunch', short: 'Carrots', category: 'Produce', section: 'produce', cost: 0.46, price: 1.29, shelfLife: 14, caseSize: 12, demand: 0.8, color: '#e3761a', kind: 'produce', tier: 2, fixture: 'bin-2', description: 'Crunchy and cheap, with the tops still on.' },
  { id: 'onions', name: 'Yellow onions', short: 'Onions', category: 'Produce', section: 'produce', cost: 0.3, price: 0.99, shelfLife: 21, caseSize: 12, demand: 0.82, color: '#c98a2e', kind: 'produce', tier: 3, fixture: 'bin-3', description: 'Every recipe starts with one.' },
  { id: 'peppers', name: 'Bell peppers', short: 'Peppers', category: 'Produce', section: 'produce', cost: 0.7, price: 1.89, shelfLife: 7, caseSize: 10, demand: 0.6, color: '#c8321e', kind: 'produce', tier: 3, fixture: 'bin-4', description: 'Red, yellow and green. Glossy and a little pricey.' },
  { id: 'grapes', name: 'Green grapes', short: 'Grapes', category: 'Produce', section: 'produce', cost: 1.35, price: 3.29, shelfLife: 6, caseSize: 8, demand: 0.55, color: '#9cc24a', kind: 'produce', tier: 3, fixture: 'bin-5', description: 'A treat that sells itself and spoils fast.' },
  { id: 'flour', name: 'All-purpose flour · 5 lb', short: 'Flour', category: 'Dry goods', section: 'dry', cost: 1.9, price: 3.99, shelfLife: 270, caseSize: 6, demand: 0.6, color: '#e6e0d0', kind: 'bag', tier: 2, fixture: 'shelf-1', description: 'A baking staple that keeps for months.' },
  { id: 'sugar', name: 'Granulated sugar · 4 lb', short: 'Sugar', category: 'Dry goods', section: 'dry', cost: 1.75, price: 3.69, shelfLife: 540, caseSize: 6, demand: 0.7, color: '#f1eee4', kind: 'bag', tier: 2, fixture: 'shelf-2', description: 'Practically immortal. Steady sales.' },
  { id: 'oats', name: 'Rolled oats', short: 'Oats', category: 'Dry goods', section: 'dry', cost: 1.45, price: 3.29, shelfLife: 300, caseSize: 6, demand: 0.55, color: '#2d5da6', kind: 'box', tier: 3, fixture: 'shelf-3', description: 'Breakfast in a round blue canister.' },
  { id: 'peanutbutter', name: 'Peanut butter · jar', short: 'Peanut butter', category: 'Dry goods', section: 'dry', cost: 1.6, price: 3.79, shelfLife: 360, caseSize: 8, demand: 0.75, color: '#b9803a', kind: 'jar', tier: 3, fixture: 'shelf-4', description: 'A lunchbox essential with a healthy margin.' },
  { id: 'chips', name: 'Potato chips', short: 'Chips', category: 'Snacks', section: 'dry', cost: 1.05, price: 2.79, shelfLife: 75, caseSize: 10, demand: 1.2, color: '#f4cf2a', kind: 'bag', tier: 2, fixture: 'shelf-5', description: 'The impulse buy of the neighborhood.' },
  { id: 'cookies', name: 'Chocolate chip cookies', short: 'Cookies', category: 'Snacks', section: 'dry', cost: 1.2, price: 2.99, shelfLife: 60, caseSize: 8, demand: 0.85, color: '#c8903f', kind: 'box', tier: 3, fixture: 'shelf-6', description: 'Sweet, packaged and popular after school.' },
  { id: 'candybar', name: 'Chocolate bar', short: 'Candy bar', category: 'Snacks', section: 'dry', cost: 0.4, price: 1.29, shelfLife: 150, caseSize: 24, demand: 1.1, color: '#5a2e18', kind: 'bar', tier: 3, fixture: 'shelf-7', description: 'Cheap, small and always by the register in spirit.' },
  { id: 'orangejuice', name: 'Orange juice · 52 oz', short: 'Orange juice', category: 'Drinks', section: 'chilled', cost: 2.2, price: 4.49, shelfLife: 12, caseSize: 6, demand: 0.7, color: '#f5a21e', kind: 'carton', tier: 1, description: 'Chilled and breakfast-bound.' },
  { id: 'bacon', name: 'Sliced bacon', short: 'Bacon', category: 'Meat', section: 'chilled', cost: 3.1, price: 6.29, shelfLife: 14, caseSize: 6, demand: 0.6, color: '#a8231c', kind: 'tray', tier: 3, fixture: 'cooler-1', description: 'Weekend favorite. Keep it cold.' },
  { id: 'sourcream', name: 'Sour cream', short: 'Sour cream', category: 'Dairy', section: 'chilled', cost: 0.95, price: 2.29, shelfLife: 16, caseSize: 8, demand: 0.45, color: '#f3f1e6', kind: 'tub', tier: 3, fixture: 'cooler-2', description: 'A slow mover, but the tacos need it.' },
];

// Tier 1 is the everyday basics. A few established lines, which already have their own space, open at tier 2.
const TIER_TWO_LINES = new Set(['yogurt', 'deli', 'pizza', 'icecream']);
for (const product of PRODUCTS) product.tier ??= TIER_TWO_LINES.has(product.id) ? 2 : 1;
export const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

/** The store level each tier of product opens at: tier 1 is the basics the shop opens with, 2 and 3 widen the range. Add more tiers here. */
export const TIERS = [
  { tier: 1, level: 1, name: 'Corner Basics' },
  { tier: 2, level: 3, name: 'Growing Range' },
  { tier: 3, level: 5, name: 'Full Range' },
];

/**
 * Floor space that can be bought for the new lines, keyed to the layout's fixtures (layout.js has where
 * each stands). A line on one is sold once the store's level opens its tier and the fixture is bought.
 */
export const FIXTURES = [
  { id: 'bin-1', type: 'bin', label: 'Produce bin', detail: 'A slatted bin on the produce island', cost: 120 },
  { id: 'bin-2', type: 'bin', label: 'Produce bin', detail: 'A second bin on the produce island', cost: 120 },
  { id: 'bin-3', type: 'bin', label: 'Produce bin', detail: 'A third bin on the produce island', cost: 120 },
  { id: 'bin-4', type: 'bin', label: 'Produce bin', detail: 'A bin in the second produce column', cost: 120 },
  { id: 'bin-5', type: 'bin', label: 'Produce bin', detail: 'A second bin in that column', cost: 120 },
  { id: 'shelf-1', type: 'shelf', label: 'Pantry shelf', detail: 'A top board on the pantry gondola', cost: 85 },
  { id: 'shelf-2', type: 'shelf', label: 'Pantry shelf', detail: 'A new snack gondola, bottom front board', cost: 190 },
  { id: 'shelf-3', type: 'shelf', label: 'Pantry shelf', detail: 'Snack gondola, middle front board', cost: 85 },
  { id: 'shelf-4', type: 'shelf', label: 'Pantry shelf', detail: 'Snack gondola, top front board', cost: 85 },
  { id: 'shelf-5', type: 'shelf', label: 'Pantry shelf', detail: 'Snack gondola, bottom back board', cost: 85 },
  { id: 'shelf-6', type: 'shelf', label: 'Pantry shelf', detail: 'Snack gondola, middle back board', cost: 85 },
  { id: 'shelf-7', type: 'shelf', label: 'Pantry shelf', detail: 'Snack gondola, top back board', cost: 85 },
  { id: 'cooler-1', type: 'cooler', label: 'Reach-in cooler', detail: 'A two-shelf glass-door cooler on the right wall', cost: 320 },
  { id: 'cooler-2', type: 'cooler', label: 'Reach-in cooler', detail: 'A second glass door', cost: 260 },
];
export const FIXTURE_BY_ID = Object.fromEntries(FIXTURES.map((f) => [f.id, f]));
for (const fixture of FIXTURES) fixture.products = PRODUCTS.filter((p) => p.fixture === fixture.id).map((p) => p.id);
for (const fixture of FIXTURES) fixture.tier = Math.min(...fixture.products.map((id) => PRODUCT_BY_ID[id].tier));
export const STAFF = [
  { id: 'lou', name: 'Lou Rivera', role: 'Counter host · guest orders', character: 'gent', wage: 14, color: '#e0b982', quality: 86 },
  { id: 'bob', name: 'Bob', role: 'Barista · breakfast preparation', character: 'barista', wage: 12, color: '#64a9a3', quality: 88 },
  { id: 'waiter', name: 'Waiter', role: 'Dining room · table service', character: 'waiter', wage: 15, color: '#c5a06a', quality: 82 },
];
/**
 * A small, hand-written review history establishes the shop's reputation
 * before the new owner takes over. New reviews are chosen from the banks
 * below, then personalised with the shopper and the item they came for.
 */
const OPENING_REVIEWS = [
  { id: 1, name: 'A. Brooks', rating: 5, text: 'The soft eggs are lovely and Lou remembers exactly how I take my coffee.', day: 0, minute: 0, source: 'Local regular' },
  { id: 2, name: 'S. Morales', rating: 4, text: 'A proper neighborhood breakfast cafe. Bob makes a great coffee and the booths are comfortable.', day: 0, minute: 0, source: 'Local regular' },
  { id: 3, name: 'J. Kim', rating: 5, text: 'Good toast, strong coffee and a sunny-side-up egg cooked just right. I will be back.', day: 0, minute: 0, source: 'Nearby resident' },
  { id: 4, name: 'T. Rivera', rating: 4, text: 'A welcoming little cafe with a real breakfast menu and friendly service.', day: 0, minute: 0, source: 'Nearby resident' },
];

/** Prewritten, deliberately varied copy for the simulated neighborhood review feed. */
export const REVIEW_BANK = Object.freeze({
  expired: [
    'The {{product}} did not taste fresh. Please check the kitchen dates before serving.',
    'I was looking forward to {{product}}, but the ingredients tasted past their best.',
    'The {{product}} was disappointing today. Freshness matters in a breakfast cafe.',
    'Please check ingredient rotation. My {{product}} tasted as though it had been sitting too long.',
    'The {{product}} should have been caught before it reached the pass.',
    'I sent the {{product}} back because it did not taste fresh.',
    'The date on the {{product}} was a concern. The kitchen needs a tighter check.',
    'A breakfast plate should be fresh to order. The {{product}} missed that mark.',
  ],
  stockout: [
    'I came in for {{product}}, but the kitchen had run out. A little frustrating.',
    'Good service, but {{product}} was unavailable during the breakfast rush.',
    'Wanted {{product}} and had to choose something else. Please prep a few more portions.',
    'The {{product}} was off the menu when I arrived. I hope that is not a regular thing.',
    'I had to change my order because the cafe was out of {{product}}.',
  ],
  partial: [
    'The coffee was good, but part of my order was missing, especially the {{product}}.',
    'A mixed visit: friendly service, but I could only get part of my breakfast because {{product}} was unavailable.',
    'I enjoyed the cafe, though the kitchen ran short on {{product}}.',
    'Most of breakfast was lovely. It would have been better if the {{product}} had been ready.',
  ],
  pricey: [
    'The {{product}} is a bit steep for the portion. I expected more for the price.',
    'Lovely staff, but I am not sure the {{product}} is worth that price.',
    'Wanted {{product}}, saw the price and chose something else. Revisit the menu pricing.',
    'Convenient breakfast stop, but the {{product}} feels overpriced.',
    'The service was warm. The price of the {{product}} was not.',
  ],
  five: [
    'My favorite breakfast stop on the block. Lou knows the regulars and the coffee is always ready.',
    'Perfect soft eggs, golden toast and a warm welcome. Exactly what a neighborhood cafe should be.',
    'Bob made a beautiful breakfast and checked that everything was right. Lovely service.',
    'Stopped in for coffee and stayed for the best breakfast I have had in weeks.',
    'The booth seats are comfortable, the coffee is strong and the eggs are excellent.',
    'Good portions, a thoughtful menu and genuinely kind people. Five stars.',
    'Fresh toast, hot coffee and a sunny-side-up egg cooked perfectly.',
    'This place has real neighborhood energy. I would rather eat here than at a chain.',
    'Quick service without feeling rushed. The crew make it feel like a local place.',
    'The cafe sign makes me smile every morning. Breakfast is excellent too.',
    'A lovely cafe for a slow morning. The omelette was soft and the juice was fresh.',
    'Everything came out hot and the staff were welcoming.',
  ],
  four: [
    'A dependable neighborhood cafe. A couple of dishes take a little longer, but the coffee is worth it.',
    'Friendly crew and a good breakfast menu. Could use a little more room at peak time.',
    'The eggs were excellent and the booths are comfortable. Busy around brunch, so plan accordingly.',
    'Good local cafe with a bit of personality. The dining room has real charm.',
    'Usually has what I want. I wish the toast came out with the eggs a little more often.',
    'Much better than a quick-stop chain. A short wait today, but the service was great.',
    'Fair prices, helpful people and a good cup of coffee. Four stars because the queue can build up.',
    'I like supporting the neighborhood. Keep the breakfast menu this good and I will stay a regular.',
  ],
  three: [
    'It does the job. Some mornings are great, other mornings are a little hit or miss.',
    'A convenient cafe, though the menu is limited and some portions vary.',
    'Nothing terrible, nothing amazing. Fine for a quick breakfast.',
    'The staff were nice. My coffee arrived before the food and was cold by the time breakfast came.',
    'Good location and a lot of character. The breakfast experience was pretty average today.',
    'I want to like this place more. A little consistency with timing would make a difference.',
  ],
  two: [
    'The table was not cleared and the kitchen seemed overwhelmed. Needs attention.',
    'A frustrating breakfast. The wait was long and my order arrived incomplete.',
    'I know it is a small cafe, but the menu felt very limited today.',
    'Convenient location, disappointing visit. I had to find breakfast somewhere else.',
    'Not the usual friendly experience. Hopefully today was just an off day.',
    'My eggs were overcooked and the coffee was lukewarm. A disappointing start to the day.',
  ],
});

const STARTING_CASH = 1250;
const CREDIT_LIMIT = 1800;
const DAY_OPEN = 7 * 60;
const DAY_CLOSE = 21 * 60;
/** The last diner is let in this long before closing, so everyone is served before the shutters come down. */
const LAST_CALL = DAY_CLOSE - 30;
const EXPIRY_BUFFER = 1e-8;
const STAFF_PAYROLL = STAFF.reduce((n, s) => n + s.wage, 0);
const STORE_LEVEL_XP = 250;
export const getStoreLevel = (state) => 1 + Math.floor(Math.max(0, state.experience ?? 0) / STORE_LEVEL_XP);
export function getStoreLevelProgress(state) {
  const level = getStoreLevel(state);
  const floor = (level - 1) * STORE_LEVEL_XP;
  const next = level * STORE_LEVEL_XP;
  const experience = Math.max(0, state.experience ?? 0);
  return { level, experience, currentFloor: floor, nextTarget: next, remaining: Math.max(0, next - experience), progress: Math.max(0, Math.min(100, (experience - floor) / STORE_LEVEL_XP * 100)) };
}


export const tierLevel = (tier) => TIERS.find((t) => t.tier === tier)?.level ?? Infinity;
/** Whether the store's level has opened this product's tier. */
export const tierOpen = (state, product) => getStoreLevel(state) >= tierLevel(product.tier);
/** Whether a product is on sale: its tier is open and, for the new lines, its fixture is bought. */
export function isAvailable(state, product) {
  if (typeof product === 'string') product = PRODUCT_BY_ID[product];
  if (!product) return false;
  return tierOpen(state, product) && (!product.fixture || (state.fixtures ?? []).includes(product.fixture));
}
export const availableProducts = (state) => PRODUCTS.filter((p) => isAvailable(state, p));

/** What stops this fixture being bought: 'owned', 'level' or 'funds', else null. */
export function fixtureBlock(state, fixtureId) {
  const fixture = FIXTURE_BY_ID[fixtureId];
  if (!fixture) return 'unknown';
  if ((state.fixtures ?? []).includes(fixtureId)) return 'owned';
  if (getStoreLevel(state) < tierLevel(fixture.tier)) return 'level';
  if (state.cash + 1e-8 < fixture.cost) return 'funds';
  return null;
}

/** Everything on the floor that can be moved, each with where it stands: [{ piece, x, z, rot }]. */
export function standingPieces(state) {
  return PIECES.filter((piece) => isStanding(piece, new Set(state.fixtures)))
    .map((piece) => ({ piece, ...(state.layout[piece.id] ?? piece.home) }));
}

/** Move a bought shelf, bin or cooler. Shelves and bins stand clear of walls; a cooler goes flat against one. */
export function placeFixture(state, pieceId, placement) {
  const piece = PIECE_BY_ID[pieceId];
  if (!piece || !isStanding(piece, new Set(state.fixtures))) return { ok: false, reason: 'not-owned' };
  if (piece.movable === false) return { ok: false, reason: 'fixed' };
  const p = { x: Number(placement?.x), z: Number(placement?.z), rot: Number(placement?.rot) };
  if (![p.x, p.z, p.rot].every(Number.isFinite) || !Number.isInteger(p.rot) || p.rot < 0 || p.rot > 3) return { ok: false, reason: 'invalid' };
  const reason = canPlace(pieceId, p, state.fixtures, state.layout);
  if (reason) return { ok: false, reason };
  state.layout[pieceId] = p;
  pushEvent(state, 'note', `${piece.name} was moved.`, 'Diners and the cafe crew use the room as soon as it is ready.');
  return { ok: true };
}

/** Buy a shelf, bin or cooler with register cash. It opens the lines that stand on it. */
export function buyFixture(state, fixtureId) {
  const block = fixtureBlock(state, fixtureId);
  const fixture = FIXTURE_BY_ID[fixtureId];
  if (block === 'unknown') return { ok: false, reason: 'unknown-fixture' };
  if (block === 'owned') return { ok: false, reason: 'already-owned' };
  if (block === 'level') return { ok: false, reason: 'level-too-low', level: tierLevel(fixture.tier) };
  if (block === 'funds') return { ok: false, reason: 'insufficient-funds', shortfall: fixture.cost - state.cash };
  state.cash = Math.round((state.cash - fixture.cost) * 100) / 100;
  state.fixtures.push(fixtureId);
  state.dayStats.fixtures = (state.dayStats.fixtures ?? 0) + fixture.cost;
  const names = fixture.products.map((id) => PRODUCT_BY_ID[id].short.toLowerCase()).join(' and ');
  pushEvent(state, 'order', `New ${fixture.label.toLowerCase()} installed.`, `${money(fixture.cost)} from the register · room for ${names}.`);
  return { ok: true, cost: fixture.cost, products: fixture.products };
}

export const money = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
export const productNow = (state) => state.day + state.minute / 1440;
export const productOf = (id) => PRODUCT_BY_ID[id];
export const qtyOf = (batches = []) => batches.reduce((n, batch) => n + batch.qty, 0);
export const isExpired = (batch, now) => batch.expiresAt <= now + EXPIRY_BUFFER;
export const expiryDaysLeft = (batch, now) => Math.max(0, batch.expiresAt - now);
export const sortOldestFirst = (batches) => batches.sort((a, b) => a.expiresAt - b.expiresAt || a.receivedAt - b.receivedAt || a.lotId - b.lotId);

function createRng(seed, restore = false) {
  let value = seed >>> 0 || 1;
  const random = () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
  random.getState = () => value;
  return random;
}

/** A JSON-safe snapshot for local saves. The random stream resumes exactly where it left off. */
export function saveGameState(state) {
  const { random, availableResidents, ...serializable } = state; // eslint-disable-line no-unused-vars
  return JSON.stringify({ ...serializable, rngState: random.getState() });
}

/** Restore a save while keeping the simulation's functions out of storage. */
export function loadGameState(serialized) {
  try {
    const saved = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
    if (!saved || saved.version !== 1 || !Number.isFinite(saved.day) || !saved.shelves || !saved.stockroom) return null;
    const state = createGameState(saved.rngState ?? 1);
    Object.assign(state, saved);
    state.random = createRng(saved.rngState ?? 1);
    state.paused = false; // Resume active days on reload; no offline time is simulated.
    state.fixtures = Array.isArray(saved.fixtures) ? saved.fixtures.filter((id) => FIXTURE_BY_ID[id]) : [];
    // Saves from before a line existed have no stock record for it.
    for (const product of PRODUCTS) {
      state.shelves[product.id] ??= [];
      state.stockroom[product.id] ??= [];
      state.prices[product.id] ??= product.price;
    }
    // Keep only placements that still make sense: an owned piece, standing somewhere it may.
    state.layout = {};
    for (const [id, p] of Object.entries(saved.layout ?? {})) {
      const piece = PIECE_BY_ID[id];
      const sound = piece && [p?.x, p?.z, p?.rot].every(Number.isFinite) && Number.isInteger(p.rot) && p.rot >= 0 && p.rot < 4;
      if (sound && isStanding(piece, new Set(state.fixtures)) && !placementProblem(id, p, state.fixtures, state.layout)) state.layout[id] = { x: p.x, z: p.z, rot: p.rot };
    }
    state.orderCases = { ...Object.fromEntries(PRODUCTS.map((p) => [p.id, 1])), ...state.orderCases };
    state.reviews ??= OPENING_REVIEWS.map((review) => ({ ...review })).reverse();
    state.dayStats ??= {};
    state.reviews = state.reviews.filter((review) => !String(review.outcome ?? '').startsWith('cat-'));
    if (Array.isArray(state.events)) state.events = state.events.filter((event) => event.type !== 'cat');
    delete state.dayStats.catLoved;
    delete state.dayStats.catAnnoyed;
    state.dayStats.foodQualityTotal ??= 0;
    state.dayStats.serviceQualityTotal ??= 0;
    state.dayStats.ordersServed ??= 0;
    state.reviewSequence ??= Math.max(0, ...state.reviews.map((review) => review.id || 0));
    state.staffWork ??= { stage: 'idle', productId: null, timer: 0, duration: 0, moved: 0 };
    state.waiterWork ??= { stage: 'idle', customerId: null, seatId: null, timer: 0, duration: 0 };
    for (const customer of state.customers) {
      customer.arrivalDuration ??= 2.4;
      customer.arrivalTimer ??= 0;
      if (!customer.serviceStatus) customer.serviceStatus = customer.phase === 'browsing' ? 'waiting' : 'served';
      const seat = CAFE_SEATS.find((candidate) => candidate.id === customer.seatId);
      if (customer.phase === 'browsing' && seat && !customer.orderedMenuId) {
        customer.serviceStatus = 'waiting';
        customer.servedAt = null;
        customer.arrivalTimer = 0;
        customer.menuChoiceId ??= 'scrambled-eggs';
        customer.phaseTimer = Math.max(customer.phaseTimer ?? 0, 12);
      }
      customer.foodQuality ??= null;
      customer.serviceQuality ??= null;
    }
    state.experience ??= 0;
    // Saves from before the cafe had no purchasing manager or cats may carry their leftovers.
    for (const key of ['purchasingManagerHired', 'automaticPurchasingEnabled', 'nextAutoOrderAt']) delete state[key];
    state.playerPosition ??= { x: 1.1, z: -6.18 };
    if (Math.abs(state.playerPosition.x - 4.5) < 0.1 && Math.abs(state.playerPosition.z - 5.2) < 0.1) state.playerPosition = { x: 1.1, z: -6.18 };
    state.dailyCosts.payroll = STAFF_PAYROLL;
    // Give existing saves a one-time, prepaid opening reserve so the floor lead
    // can demonstrate automatic replenishment immediately after this update.
    if (!state.staffReserveSeeded) {
      const openingReserve = new Set(['apples','bananas','lettuce','milk','eggs','bread','chicken','beef','rice','pasta','soda','water']);
      for (const product of PRODUCTS) {
        if (openingReserve.has(product.id) && qtyOf(state.stockroom[product.id] ?? []) === 0) {
          state.stockroom[product.id] ??= [];
          state.stockroom[product.id].push(newBatch(state, product, product.caseSize));
        }
      }
      state.staffReserveSeeded = true;
    }
    return state;
  } catch { return null; }
}

function pushEvent(state, type, message, detail = '') {
  state.events.unshift({ id: ++state.eventSequence, type, message, detail, time: state.minute, day: state.day });
  state.events.length = Math.min(state.events.length, 32);
}

function newBatch(state, product, qty, { age = 0 } = {}) {
  const now = productNow(state);
  return {
    lotId: ++state.lotSequence,
    qty,
    receivedAt: now - age,
    expiresAt: now + product.shelfLife - age,
    unitCost: product.cost,
  };
}

function inventoryFor(products, make) {
  return Object.fromEntries(products.map((product) => [product.id, make(product)]));
}

export function createGameState(seed = 20261031) {
  const random = createRng(seed);
  const state = {
    version: 1,
    day: 1,
    minute: DAY_OPEN,
    cash: STARTING_CASH,
    debt: 0,
    creditLimit: CREDIT_LIMIT,
    creditRate: 0.0125,
    reputation: 78,
    experience: 0,
    playerPosition: { x: 1.1, z: -6.18 },
    started: false,
    paused: true,
    dayEnded: false,
    gameOver: false,
    speed: 1,
    shelves: inventoryFor(PRODUCTS, () => []),
    stockroom: inventoryFor(PRODUCTS, () => []),
    prices: Object.fromEntries(PRODUCTS.map((p) => [p.id, p.price])),
    customers: [],
    nextArrival: DAY_OPEN + 18,
    customerSequence: 0,
    lotSequence: 0,
    eventSequence: 0,
    events: [],
    reviews: OPENING_REVIEWS.map((review) => ({ ...review })).reverse(),
    reviewSequence: OPENING_REVIEWS.length,
    random,
    dayStats: { revenue: 0, unitsSold: 0, customers: 0, complaints: 0, waste: 0, purchases: 0, grossProfit: 0, stockouts: 0, foodQualityTotal: 0, serviceQualityTotal: 0, ordersServed: 0 },
    lifetime: { revenue: 0, customers: 0, complaints: 0, waste: 0, days: 0 },
    dailyCosts: { rent: 24, payroll: STAFF_PAYROLL, utilities: 8 },
    supplierOrders: 0,
    staffReserveSeeded: true,
    staffWork: { stage: 'idle', productId: null, timer: 0, duration: 0, moved: 0 },
    waiterWork: { stage: 'idle', customerId: null, seatId: null, timer: 0, duration: 0 },
    lastDaySummary: null,
    fixtures: [],
    layout: {},
  };

  // Most opening stock is already on the shop floor; perishable lines include
  // a small older delivery so rotation is a real first-day responsibility.
  for (const product of PRODUCTS.filter((p) => !p.fixture)) {
    const startingQty = product.section === 'chilled' ? 5 : product.section === 'produce' ? 7 : 6;
    const olderQty = ['bananas', 'lettuce', 'milk', 'bread', 'chicken', 'beef', 'tomatoes'].includes(product.id) ? 2 : 0;
    if (olderQty) state.shelves[product.id].push(newBatch(state, product, olderQty, { age: Math.min(1.2, product.shelfLife * 0.3) }));
    state.shelves[product.id].push(newBatch(state, product, startingQty - olderQty));
    sortOldestFirst(state.shelves[product.id]);
  }
  // Opening reserve is already-paid inventory. Bob has real backroom stock
  // to work from on day one, rather than being a decorative employee.
  const openingReserve = new Set(['apples','bananas','lettuce','milk','eggs','bread','chicken','beef','rice','pasta','soda','water']);
  for (const product of PRODUCTS) {
    if (!openingReserve.has(product.id)) continue;
    state.stockroom[product.id].push(newBatch(state, product, product.caseSize));
  }
  pushEvent(state, 'note', 'The keys are yours.', 'Lou, Bob and the waiter are ready for breakfast service.');
  pushEvent(state, 'stock', 'Opening pantry reserve is ready.', 'Bob will automatically replenish low shelves and rotate the oldest valid lots first.');
  pushEvent(state, 'note', 'Three new managers clocked in.', 'Blaze, Jinx, and Nyx are already on the floor.');
  return state;
}

export function shelfQuantity(state, productId) { return qtyOf(state.shelves[productId]); }
export function stockroomQuantity(state, productId) { return qtyOf(state.stockroom[productId]); }
export function expiredQuantity(state, productId) {
  const now = productNow(state);
  return qtyOf(state.shelves[productId].filter((b) => isExpired(b, now))) + qtyOf(state.stockroom[productId].filter((b) => isExpired(b, now)));
}
export function oldestShelfBatch(state, productId) {
  sortOldestFirst(state.shelves[productId]);
  return state.shelves[productId][0] ?? null;
}
export function inventoryHealth(state) {
  return availableProducts(state).reduce((out, product) => {
    const shelf = state.shelves[product.id];
    out.expired += qtyOf(shelf.filter((b) => isExpired(b, productNow(state))));
    out.low += shelfQuantity(state, product.id) <= 2 ? 1 : 0;
    out.empty += shelfQuantity(state, product.id) === 0 ? 1 : 0;
    return out;
  }, { expired: 0, low: 0, empty: 0 });
}

/** Transfer the earliest-expiring backroom lots to the shelf without resetting their dates. */
export function restockProduct(state, productId, requested = Infinity) {
  const product = PRODUCT_BY_ID[productId];
  if (!product) return { moved: 0, reason: 'unknown-product' };
  const shelf = sortOldestFirst(state.shelves[productId]);
  const stockroom = sortOldestFirst(state.stockroom[productId]);
  const onShelf = qtyOf(shelf);
  const capacity = product.section === 'produce' ? 24 : product.section === 'chilled' ? 30 : 36;
  const space = Math.max(0, capacity - onShelf);
  let remaining = Math.min(space, Math.max(0, requested));
  let moved = 0;
  const now = productNow(state);
  // Never put already-expired stock back on the floor. Valid lots retain their
  // original received/expiry dates and are merged by earliest expiry.
  for (const batch of stockroom) {
    if (remaining <= 0) break;
    if (batch.qty <= 0 || isExpired(batch, now)) continue;
    const take = Math.min(batch.qty, remaining);
    const existing = shelf.find((b) => b.lotId === batch.lotId);
    if (existing) existing.qty += take;
    else shelf.push({ ...batch, qty: take });
    batch.qty -= take;
    moved += take;
    remaining -= take;
  }
  state.stockroom[productId] = sortOldestFirst(stockroom.filter((batch) => batch.qty > 0));
  state.shelves[productId] = sortOldestFirst(shelf);
  if (moved) pushEvent(state, 'stock', `${moved} ${product.short.toLowerCase()} moved to the shelf.`, 'Oldest valid date is at the front; expired backroom stock was left out.');
  return {
    moved,
    remainingSpace: space - moved,
    reason: moved ? 'restocked' : onShelf >= capacity ? 'shelf-full' : stockroom.some((batch) => batch.qty > 0) ? 'only-expired-stock' : 'backroom-empty',
  };
}

export function restockAll(state) {
  const results = availableProducts(state).map((product) => ({ productId: product.id, ...restockProduct(state, product.id) })).filter((r) => r.moved > 0);
  return results.reduce((total, r) => total + r.moved, 0);
}

/** Place a wholesale case order. Delivery goes into the stockroom, never straight onto the shelf. */
export function placeOrder(state, productId, cases = 1) {
  const product = PRODUCT_BY_ID[productId];
  const count = Math.floor(Number(cases));
  if (!product || !Number.isFinite(count) || count < 1 || count > 20) return { ok: false, reason: 'invalid-quantity' };
  if (!isAvailable(state, product)) return { ok: false, reason: 'not-stocked' };
  const qty = product.caseSize * count;
  const total = Math.round(product.cost * qty * 100) / 100;
  if (state.cash + 1e-8 < total) return { ok: false, reason: 'insufficient-funds', total, shortfall: total - state.cash };
  state.cash = Math.round((state.cash - total) * 100) / 100;
  state.stockroom[productId].push(newBatch(state, product, qty));
  sortOldestFirst(state.stockroom[productId]);
  state.dayStats.purchases += total;
  state.supplierOrders += 1;
  pushEvent(state, 'order', `${count} case${count === 1 ? '' : 's'} of ${product.short.toLowerCase()} delivered.`, `${qty} units · ${money(total)} · stockroom delivery`);
  return { ok: true, qty, total, expiresAt: productNow(state) + product.shelfLife };
}

export function adjustPrice(state, productId, delta) {
  const product = PRODUCT_BY_ID[productId];
  if (!product || !Number.isFinite(delta)) return false;
  const next = Math.round((state.prices[productId] + delta) * 100) / 100;
  state.prices[productId] = Math.max(product.cost * 1.08, Math.min(product.price * 2.25, next));
  return true;
}

/** Remove all expired units from shelves and stockroom. Waste is recorded at cost, not retail price. */
export function pullExpired(state, productId = null) {
  const ids = productId ? [productId] : PRODUCTS.map((p) => p.id);
  const now = productNow(state);
  let removed = 0, loss = 0;
  for (const id of ids) {
    const product = PRODUCT_BY_ID[id];
    if (!product) continue;
    for (const location of [state.shelves, state.stockroom]) {
      const keep = [];
      for (const batch of location[id]) {
        if (isExpired(batch, now)) { removed += batch.qty; loss += batch.qty * batch.unitCost; }
        else keep.push(batch);
      }
      location[id] = sortOldestFirst(keep);
    }
  }
  if (removed) {
    state.dayStats.waste += loss;
    state.lifetime.waste += loss;
    pushEvent(state, 'waste', `${removed} expired units pulled.`, `${money(loss)} written off at wholesale cost.`);
  } else pushEvent(state, 'good', 'No expired stock found.', 'The shelves and stockroom are clear.');
  return { removed, loss };
}

/**
 * The neighborhood's regulars. Each is a person from the engine's cast, dressed
 * in a skin tone, hair and eyes of their own (`look` goes to `character.variant`
 * in the world), with habits that shape the store's day: what they come for
 * (`favorites`), how much a price rise bothers them (`thrift`: the markup over
 * the usual price they will pay), how big a shop they make (`lines`: the chance
 * of a third basket line), when they tend to come in (`peak`: hours of the day).
 */
export const RESIDENTS = [
  { id: 'maya', name: 'Maya', full: 'Maya Okafor', character: 'tourist', tag: 'weekend visitor', look: { skin: '#6f4120', hair: '#0e0a08', eyes: '#2a1a10' }, height: 1.38, favorites: ['water', 'bananas', 'coffee', 'cereal'], thrift: 0.35, lines: 0.28, peak: [10, 17] },
  { id: 'rico', name: 'Rico', full: 'Rico Alvarez', character: 'punk', tag: 'regular', look: { skin: '#c68642', hair: '#0e0a08', eyes: '#4a2e18' }, height: 1.4, favorites: ['soda', 'pizza', 'icecream'], thrift: 0.3, lines: 0.2, peak: [15, 21] },
  { id: 'sunny', name: 'Sunny', full: 'Sunny Park', character: 'hippie', tag: 'produce fan', look: { skin: '#f0d0c0', hair: '#241810', eyes: '#2a1a10' }, height: 1.36, favorites: ['apples', 'tomatoes', 'lettuce', 'rice', 'beans'], thrift: 0.4, lines: 0.5, peak: [8, 13] },
  { id: 'theo', name: 'Theo', full: 'Theo Laurent', character: 'artist', tag: 'local artist', look: { skin: '#8d5524', hair: '#0e0a08', eyes: '#2a1a10' }, height: 1.42, favorites: ['coffee', 'bread', 'cheese', 'butter'], thrift: 0.3, lines: 0.28, peak: [9, 15] },
  { id: 'ari', name: 'Ari', full: 'Ari Cohen', character: 'hipster', tag: 'coffee regular', look: { skin: '#f6dcc8', hair: '#8a3a1e', eyes: '#5a86b0' }, height: 1.44, favorites: ['coffee', 'eggs', 'yogurt', 'bread'], thrift: 0.55, lines: 0.28, peak: [7, 10] },
  { id: 'sal', name: 'Sal', full: 'Sal Haddad', character: 'cabbie', tag: 'night-shift driver', look: { skin: '#d19a6a', hair: '#241810', eyes: '#4a2e18' }, height: 1.42, favorites: ['coffee', 'water', 'bananas', 'deli'], thrift: 0.3, lines: 0.2, peak: [17, 21] },
  { id: 'russo', name: 'Mrs. Russo', full: 'Rosa Russo', character: 'nonna', tag: 'neighbor', look: { skin: '#f0d0c0', hair: '#e8e6e0', eyes: '#6a7a8a' }, height: 1.24, favorites: ['pasta', 'tomatoes', 'cheese', 'bread', 'eggs'], thrift: 0.2, lines: 0.6, peak: [8, 12] },
  { id: 'dwayne', name: 'Dwayne', full: 'Dwayne Brooks', character: 'beerguy', tag: 'after-work regular', look: { skin: '#533018', hair: '#0e0a08', eyes: '#2a1a10' }, height: 1.46, favorites: ['soda', 'pizza', 'deli', 'chicken'], thrift: 0.35, lines: 0.35, peak: [16, 21] },
  { id: 'kenji', name: 'Kenji', full: 'Kenji Watanabe', character: 'salaryman', tag: 'commuter', look: { skin: '#f0d0c0', hair: '#0e0a08', eyes: '#2a1a10' }, height: 1.4, favorites: ['coffee', 'deli', 'bread', 'water', 'yogurt'], thrift: 0.6, lines: 0.28, peak: [7, 9] },
  { id: 'marco', name: 'Marco', full: 'Marco Bianchi', character: 'pizzaiolo', tag: 'late lunch', look: { skin: '#e9b48f', hair: '#3a2414', eyes: '#4a2e18' }, height: 1.4, favorites: ['cheese', 'tomatoes', 'pasta', 'beef'], thrift: 0.3, lines: 0.4, peak: [13, 16] },
  { id: 'jules', name: 'Jules', full: 'Jules Moreno', character: 'skater', tag: 'local kid', look: { skin: '#e0a97c', hair: '#5a3a1e', eyes: '#6a4a22' }, height: 1.2, favorites: ['soda', 'pizza', 'icecream', 'cereal'], thrift: 0.2, lines: 0.15, peak: [15, 19] },
  { id: 'priya', name: 'Priya', full: 'Priya Nair', character: 'shopper', tag: 'weekly shop', look: { skin: '#a9703f', hair: '#0e0a08', eyes: '#2a1a10' }, height: 1.4, favorites: ['rice', 'beans', 'tomatoes', 'yogurt', 'lettuce', 'chicken'], thrift: 0.45, lines: 0.75, peak: [10, 15] },
  { id: 'walt', name: 'Walt', full: 'Walter Jenkins', character: 'oldtimer', tag: 'been coming here forever', look: { skin: '#3b2314', hair: '#9a9a9a', eyes: '#4a2e18' }, height: 1.34, favorites: ['bread', 'milk', 'eggs', 'coffee', 'butter'], thrift: 0.15, lines: 0.3, peak: [7, 11] },
  { id: 'luis', name: 'Luis', full: 'Luis Ortega', character: 'mailcarrier', tag: 'mail carrier', look: { skin: '#c68642', hair: '#241810', eyes: '#4a2e18' }, height: 1.42, favorites: ['water', 'bananas', 'deli', 'bread'], thrift: 0.35, lines: 0.2, peak: [11, 14] },
  { id: 'aisha', name: 'Aisha', full: 'Aisha Rahman', character: 'crossingguard', tag: 'school crossing guard', look: { skin: '#a9703f', hair: '#241810', eyes: '#3a2414' }, height: 1.36, favorites: ['milk', 'eggs', 'cereal', 'bananas', 'apples'], thrift: 0.3, lines: 0.5, peak: [8, 9.5] },
  { id: 'tomasz', name: 'Tomasz', full: 'Tomasz Kowalski', character: 'engineer', tag: 'site engineer', look: { skin: '#f6dcc8', hair: '#c8a45a', eyes: '#3a5a8a' }, height: 1.46, favorites: ['coffee', 'soda', 'deli', 'bread'], thrift: 0.4, lines: 0.3, peak: [7, 9] },
  { id: 'camille', name: 'Camille', full: 'Camille Dubois', character: 'barista', tag: 'barista off shift', look: { skin: '#533018', hair: '#0e0a08', eyes: '#2a1a10' }, height: 1.38, favorites: ['coffee', 'yogurt', 'apples', 'lettuce', 'bread'], thrift: 0.35, lines: 0.35, peak: [14, 18] },
  { id: 'zoe', name: 'Zoe', full: 'Zoe Tran', character: 'influencer', tag: 'wellness influencer', look: { skin: '#f0d0c0', hair: '#0e0a08', eyes: '#2a1a10' }, height: 1.4, favorites: ['yogurt', 'apples', 'water', 'lettuce', 'coffee'], thrift: 0.8, lines: 0.3, peak: [11, 17] },
  { id: 'dmitri', name: 'Dmitri', full: 'Dmitri Volkov', character: 'foreman', tag: 'warehouse foreman', look: { skin: '#f6dcc8', hair: '#7a5230', eyes: '#6a6a2a' }, height: 1.46, favorites: ['beef', 'potatoes', 'eggs', 'bread'], thrift: 0.25, lines: 0.3, peak: [16, 20] },
];
export const RESIDENT_BY_ID = Object.fromEntries(RESIDENTS.map((r) => [r.id, r]));

/** Who walks in next: anyone not already in the store, regulars leaning toward their usual hours. */
export function chooseResident(state) {
  const inside = new Set(state.customers.map((c) => c.residentId));
  const hour = state.minute / 60;
  // `availableResidents` (a Set of ids, set by the world as their models finish baking) is not saved.
  const ready = state.availableResidents?.size ? RESIDENTS.filter((r) => state.availableResidents.has(r.id)) : RESIDENTS;
  const pool = ready.filter((r) => !inside.has(r.id));
  const weights = pool.map((r) => (hour >= r.peak[0] && hour < r.peak[1] ? 3 : 1));
  let roll = state.random() * weights.reduce((n, w) => n + w, 0);
  for (let i = 0; i < pool.length; i++) { roll -= weights[i]; if (roll <= 0) return pool[i]; }
  return pool[pool.length - 1] ?? ready[0] ?? RESIDENTS[0];
}

const NO_FAVORITES = new Set();

/**
 * A line for the basket. Shoppers come with a list, so what they want does not
 * depend on what is on the shelf: an empty shelf is a missed sale, not a hidden
 * one. A resident's favorites weigh three times their usual demand.
 */
function weightedProduct(state, excluded = new Set(), favorites = NO_FAVORITES) {
  const pool = availableProducts(state).filter((p) => !excluded.has(p.id));
  const weight = (p) => p.demand * (favorites.has(p.id) ? 3 : 1);
  const sum = pool.reduce((n, p) => n + weight(p), 0);
  let roll = state.random() * sum;
  for (const p of pool) { roll -= weight(p); if (roll <= 0) return p; }
  return pool[pool.length - 1];
}

/** What a resident comes in for: two or three lines, leaning toward their favorites. */
export function buildBasket(state, resident) {
  const favorites = new Set(resident.favorites);
  const lineCount = state.random() < resident.lines ? 3 : 2;
  const basket = [];
  const picked = new Set();
  while (basket.length < lineCount) {
    const product = weightedProduct(state, picked, favorites);
    picked.add(product.id);
    basket.push({ productId: product.id, qty: 1 + Math.floor(state.random() * 2) });
  }
  return basket;
}

function spawnCustomer(state) {
  const diningSeats = CAFE_SEATS.filter((candidate) => candidate.style !== 'stool');
  if (state.customers.length >= Math.min(10, diningSeats.length)) return null;
  const occupiedSeats = new Set(state.customers.map((customer) => customer.seatId).filter(Boolean));
  // Guests spread out: take a free seat at the quietest table, so nobody shares a table while another sits empty.
  const diners = (tableId) => diningSeats.filter((candidate) => candidate.tableId === tableId && occupiedSeats.has(candidate.id)).length;
  const seat = diningSeats.filter((candidate) => !occupiedSeats.has(candidate.id))
    .reduce((best, candidate) => (!best || diners(candidate.tableId) < diners(best.tableId) ? candidate : best), null);
  if (!seat) return null;
  const resident = chooseResident(state);
  const menuChoices = CAFE_MENU.filter((item) => Object.keys(item.ingredients ?? {}).every((productId) => isAvailable(state, productId)));
  const menuChoice = menuChoices[Math.floor(state.random() * menuChoices.length)] ?? CAFE_MENU_BY_ID['scrambled-eggs'];
  const browseTime = 12 + state.random() * 5;
  const customer = {
    id: ++state.customerSequence,
    residentId: resident.id,
    character: resident.character,
    name: resident.name,
    reviewName: `${resident.full.split(' ')[0][0]}. ${resident.full.split(' ').slice(-1)[0]}`,
    tag: resident.tag,
    menuChoiceId: menuChoice.id,
    orderedMenuId: null,
    orderTakenAt: null,
    arrivedAt: state.minute,
    servedAt: null,
    foodQuality: null,
    serviceQuality: null,
    ingredientCoverage: null,
    foodCost: 0,
    seatId: seat.id,
    arrivalDuration: 2.4,
    arrivalTimer: 2.4,
    serviceStatus: 'waiting',
    phase: 'browsing',
    phaseTotal: browseTime,
    phaseTimer: browseTime,
    result: null,
    bought: 0,
    spend: 0,
  };
  state.customers.push(customer);
  state.dayStats.customers += 1;
  state.lifetime.customers += 1;
  pushEvent(state, 'customer', `${resident.name} took a seat.`, 'Dining room · waiting to order');
  return customer;
}

/** FIFO checkout: the first unit sold is always from the oldest non-empty lot. */
export function sellFromShelf(state, productId, requestedQty = 1) {
  const product = PRODUCT_BY_ID[productId];
  if (!product) return { ok: false, reason: 'unknown-product' };
  const batches = sortOldestFirst(state.shelves[productId]);
  if (!batches.length) return { ok: false, reason: 'out-of-stock' };
  const first = batches[0];
  if (isExpired(first, productNow(state))) return { ok: false, reason: 'expired', batch: first };
  let qty = Math.max(1, Math.floor(requestedQty));
  let revenue = 0, cost = 0, sold = 0, stopReason = null;
  while (qty > 0 && batches.length) {
    const batch = batches[0];
    // If a date boundary is crossed mid-basket, stop rather than sell it.
    if (isExpired(batch, productNow(state))) { stopReason = 'expired'; break; }
    const take = Math.min(qty, batch.qty);
    batch.qty -= take;
    qty -= take;
    sold += take;
    cost += take * batch.unitCost;
    revenue += take * state.prices[productId];
    if (batch.qty <= 0) batches.shift();
  }
  if (!sold) return { ok: false, reason: stopReason ?? 'out-of-stock', batch: first };
  state.shelves[productId] = sortOldestFirst(batches);
  revenue = Math.round(revenue * 100) / 100;
  cost = Math.round(cost * 100) / 100;
  const grossProfit = Math.round((revenue - cost) * 100) / 100;
  state.cash = Math.round((state.cash + revenue) * 100) / 100;
  state.dayStats.revenue += revenue;
  state.dayStats.unitsSold += sold;
  state.dayStats.grossProfit += grossProfit;
  state.lifetime.revenue += revenue;
  return { ok: true, qty: sold, revenue, cost, grossProfit, shortfallReason: qty > 0 ? (stopReason ?? 'out-of-stock') : null };
}

function recordExpiredComplaint(state, customer, product) {
  customer.expiredProductId ??= product.id;
  state.dayStats.complaints += 1;
  state.lifetime.complaints += 1;
  const severity = product.category === 'Meat' ? 3.2 : ['Dairy', 'Eggs'].includes(product.category) ? 2.8 : 2.25;
  customer.expiredSeverity = Math.max(customer.expiredSeverity ?? 0, severity);
  state.reputation = Math.max(0, state.reputation - severity);
  pushEvent(state, 'danger', `${customer.name} found expired ${product.short.toLowerCase()}.`, 'They put it down and told everyone in earshot. Pull the expired batch now.');
}

function recordStockout(state, customer, product, { partial = false, requested = 0, available = 0 } = {}) {
  customer.stockoutProductId ??= product.id;
  state.dayStats.stockouts += 1;
  state.reputation = Math.max(0, state.reputation - 0.25);
  const message = partial
    ? `${customer.name} could only get ${available} of ${requested} ${product.short.toLowerCase()}.`
    : `${customer.name} couldn't find ${product.short.toLowerCase()}.`;
  pushEvent(state, 'warning', message, partial ? 'The shelf ran short, so the basket was only partly filled.' : 'A shelf gap means a missed line in the basket. Reorder and restock.');
}

function awardStoreExperience(state, amount) {
  const previousLevel = getStoreLevel(state);
  state.experience = Math.max(0, Math.floor((state.experience ?? 0) + amount));
  const level = getStoreLevel(state);
  if (level > previousLevel) {
    pushEvent(state, 'level', `Store level up · Level ${level}!`, `Business experience ${state.experience} · keep serving the neighborhood.`);
  }
}

function checkoutCustomer(state, customer) {
  const basket = customer.basket ?? [{ productId: customer.demandId, qty: customer.basketUnits ?? 1 }];
  let totalSpend = 0, totalBought = 0, hadExpired = false, hadStockout = false, pricedOut = 0;
  for (const line of basket) {
    const product = PRODUCT_BY_ID[line.productId];
    if (!product) continue;
    // A shopper puts a line back if the price is past what they will pay for it.
    if (state.prices[product.id] > product.price * (1 + (customer.thrift ?? 0.45)) + 1e-9) {
      pricedOut += 1;
      state.dayStats.pricedOut = (state.dayStats.pricedOut ?? 0) + 1;
      state.reputation = Math.max(0, state.reputation - 0.1);
      pushEvent(state, 'warning', `${customer.name} put back the ${product.short.toLowerCase()}.`, `${money(state.prices[product.id])} was more than they would pay.`);
      continue;
    }
    const result = sellFromShelf(state, product.id, line.qty);
    if (result.ok) {
      totalBought += result.qty;
      totalSpend += result.revenue;
      if (result.shortfallReason === 'expired') {
        hadExpired = true;
        recordExpiredComplaint(state, customer, product);
      } else if (result.qty < line.qty) {
        hadStockout = true;
        recordStockout(state, customer, product, { partial: true, requested: line.qty, available: result.qty });
      }
    } else if (result.reason === 'expired') {
      hadExpired = true;
      recordExpiredComplaint(state, customer, product);
    } else {
      hadStockout = true;
      recordStockout(state, customer, product);
    }
  }
  customer.bought = totalBought;
  customer.spend = Math.round(totalSpend * 100) / 100;
  customer.result = hadExpired ? 'expired' : hadStockout ? (totalBought ? 'partial' : 'stockout') : pricedOut && !totalBought ? 'priced-out' : 'sold';
  if (totalBought) {
    state.reputation = Math.min(100, state.reputation + 0.12);
    pushEvent(state, 'sale', `${customer.name} checked out.`, `${totalBought} units · ${money(customer.spend)} · ${basket.length} basket lines`);
  }
  const experienceEarned = customer.result === 'sold' ? 18 + Math.floor(customer.spend * 2)
    : customer.result === 'partial' ? 8 + Math.floor(customer.spend)
      : customer.result === 'expired' ? 2 : 5;
  awardStoreExperience(state, experienceEarned);
}

const CAFE_REVIEW_ITEM_NAMES = Object.freeze({
  apples: 'apple side', bananas: 'banana toast', tomatoes: 'tomato omelette',
  lettuce: 'breakfast greens', potatoes: 'potato and egg skillet',
  milk: 'house coffee', yogurt: 'yogurt bowl', cheese: 'cheddar omelette',
  butter: 'buttered toast', eggs: 'soft scrambled eggs', bread: 'buttered toast',
  chicken: 'breakfast sandwich', beef: 'steak and eggs', deli: 'ham omelette',
  rice: 'breakfast rice bowl', pasta: 'pasta special', cereal: 'granola bowl',
  beans: 'beans on toast', coffee: 'house coffee', soda: 'cold drink',
  water: 'sparkling water', pizza: 'breakfast flatbread', icecream: 'affogato',
  oranges: 'fresh orange juice', carrots: 'carrot muffin', onions: 'diner omelette',
  peppers: 'diner omelette', grapes: 'fruit cup', flour: 'pancakes',
  sugar: 'sweetened coffee', oats: 'oatmeal', peanutbutter: 'peanut butter toast',
  chips: 'crispy potato side', cookies: 'morning cookie', candybar: 'chocolate bar',
  orangejuice: 'fresh orange juice', bacon: 'bacon and eggs', sourcream: 'omelette topping',
});

function pickReviewText(state, bank, product) {
  const template = bank[Math.floor(state.random() * bank.length)];
  return template
    .replaceAll('{{product}}', CAFE_REVIEW_ITEM_NAMES[product?.id] ?? product?.short?.toLowerCase() ?? 'breakfast');
}

const CAFE_QUALITY_REVIEW_BANK = Object.freeze({
  excellent: [
    'Beautifully cooked eggs, hot coffee and a genuinely thoughtful welcome. I will be back.',
    'Everything arrived fresh and at the right temperature. The service felt personal without hovering.',
    'A proper neighborhood breakfast: excellent food, quick service and a table ready when we arrived.',
    'The kitchen clearly knows its craft. The waiter checked in at exactly the right time.',
  ],
  good: [
    'A very good breakfast and friendly service. The coffee was strong and the eggs were cooked just right.',
    'Comfortable room, good portions and attentive staff. A little wait, but worth it.',
    'Fresh food and a warm welcome. The team handled a busy morning well.',
  ],
  mixed: [
    'The food was decent, but the service was uneven. I had to wait longer than expected for my order.',
    'A pleasant cafe, though my eggs were a little overdone and the table service could be sharper.',
    'Some parts of breakfast were lovely; other parts felt rushed. There is room to improve.',
  ],
  foodPoor: [
    'The service was polite, but the breakfast itself was disappointing. My meal did not taste freshly prepared.',
    'A friendly welcome cannot make up for overcooked eggs and tired ingredients. Please tighten kitchen quality.',
    'My order arrived, but the food was lukewarm and poorly prepared.',
  ],
  servicePoor: [
    'The food was good once it arrived, but nobody took my order promptly and the wait was frustrating.',
    'The kitchen did its part. Table service was slow and I had to ask twice about my breakfast.',
    'A decent meal, let down by inattentive service and a long wait.',
  ],
  poor: [
    'A disappointing visit from start to finish: a long wait and a poorly prepared breakfast.',
    'The order was late and the food was not good. The cafe needs to improve both kitchen and table service.',
    'I would not rush back. The meal and the service both missed the mark today.',
  ],
});

function leaveCafeQualitireview(state, customer) {
  const foodQuality = Math.max(0, Math.min(100, Number(customer.foodQuality) || 0));
  const serviceQuality = Math.max(0, Math.min(100, Number(customer.serviceQuality) || 0));
  const overall = foodQuality * 0.55 + serviceQuality * 0.45;
  const chance = overall < 58 ? 0.72 : overall < 72 ? 0.56 : 0.38;
  if (state.random() >= chance) return null;
  const rating = overall >= 91 ? 5 : overall >= 78 ? 4 : overall >= 65 ? 3 : overall >= 50 ? 2 : 1;
  const bankName = foodQuality < 58 && serviceQuality < 58 ? 'poor'
    : foodQuality < serviceQuality - 8 ? 'foodPoor'
      : serviceQuality < foodQuality - 8 ? 'servicePoor'
        : overall >= 86 ? 'excellent'
          : overall >= 72 ? 'good' : 'mixed';
  const bank = CAFE_QUALITY_REVIEW_BANK[bankName];
  const review = {
    id: ++state.reviewSequence,
    name: customer.reviewName ?? customer.name,
    rating,
    text: bank[Math.floor(state.random() * bank.length)],
    day: state.day,
    minute: state.minute,
    source: state.random() < 0.22 ? 'Local guide' : 'Verified visit',
    outcome: bankName === 'foodPoor' ? 'food-poor' : bankName === 'servicePoor' ? 'service-poor' : bankName,
    productId: null,
    menuItemId: customer.orderedMenuId ?? null,
    foodQuality,
    serviceQuality,
  };
  state.reviews.unshift(review);
  state.reviews.length = Math.min(state.reviews.length, 48);
  customer.reviewLeft = true;
  const impact = ({ 1: -0.48, 2: -0.28, 3: -0.06, 4: 0.05, 5: 0.14 })[rating];
  state.reputation = Math.max(0, Math.min(100, state.reputation + impact));
  pushEvent(state, 'review', `${customer.name} left a ${rating}-star review.`, review.text);
  return review;
}

/**
 * Publish an occasional post-visit review. Unhappy customers are substantially
 * more likely to write one, and a one-star review costs more neighborhood trust
 * than an ordinary stockout. Reviews also alter the arrival interval below.
 */
export function maybeLeaveReview(state, customer) {
  if (customer.reviewLeft) return null;
  if (Number.isFinite(customer.foodQuality) && Number.isFinite(customer.serviceQuality)) return leaveCafeQualitireview(state, customer);
  const outcome = customer.result ?? 'sold';
  const chance = outcome === 'expired' ? 0.9
    : outcome === 'stockout' || outcome === 'priced-out' ? 0.34
      : outcome === 'partial' ? 0.28 : 0.11;
  if (state.random() >= chance) return null;

  let rating, bank, reviewOutcome = outcome;
  if (outcome === 'expired') {
    rating = state.random() < 0.78 ? 1 : 2;
    bank = REVIEW_BANK.expired;
  } else if (outcome === 'priced-out') {
    rating = state.random() < 0.5 ? 2 : 3;
    bank = REVIEW_BANK.pricey;
  } else if (outcome === 'stockout') {
    rating = state.random() < 0.58 ? 2 : 3;
    bank = REVIEW_BANK.stockout;
  } else if (outcome === 'partial') {
    rating = state.random() < 0.38 ? 2 : 3;
    bank = REVIEW_BANK.partial;
  } else {
    rating = state.random() < 0.68 ? 5 : 4;
    bank = REVIEW_BANK[rating === 5 ? 'five' : 'four'];
  }
  const product = PRODUCT_BY_ID[customer.expiredProductId ?? customer.stockoutProductId ?? customer.demandId];
  const text = pickReviewText(state, bank, product);
  const review = {
    id: ++state.reviewSequence,
    name: customer.reviewName ?? customer.name,
    rating,
    text,
    day: state.day,
    minute: state.minute,
    source: state.random() < 0.22 ? 'Local guide' : 'Verified visit',
    outcome: reviewOutcome,
    productId: product?.id ?? null,
  };
  state.reviews.unshift(review);
  state.reviews.length = Math.min(state.reviews.length, 48);
  customer.reviewLeft = true;

  const reputationImpact = ({ 1: -0.48, 2: -0.28, 3: -0.06, 4: 0.05, 5: 0.14 })[rating];
  state.reputation = Math.max(0, Math.min(100, state.reputation + reputationImpact));
  pushEvent(state, 'review', `${customer.name} left a ${rating}-star review.`, text);
  return review;
}

/** The same neighborhood reputation that earns reviews also determines footfall. */
export function customerArrivalInterval(state) {
  return (18 + state.random() * 14) / trafficMultiplier(state);
}

/** Foot traffic: reputation sets it, and a bigger range (a higher store level) draws more of the block, up to half again. */
function trafficMultiplier(state) {
  const levelDraw = Math.min(1.5, 1 + 0.07 * (getStoreLevel(state) - 1));
  return (0.66 + Math.max(0, Math.min(100, state.reputation)) / 100 * 0.92) * levelDraw;
}

export function trafficLabel(state) {
  if (state.reputation >= 86) return 'BUSY';
  if (state.reputation >= 68) return 'STEADY';
  if (state.reputation >= 45) return 'QUIET';
  return 'SLOW';
}

export function reviewSummary(state) {
  const reviews = state.reviews ?? [];
  const rating = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  return { rating: Math.round(rating * 10) / 10, count: reviews.length };
}

/** Anyone still in the store when the shutters come down finishes their shop first: their sale and their opinion count. */
function finishCustomersAtClose(state) {
  for (const customer of state.customers) {
    if (customer.phase === 'browsing') {
      if (customer.orderedMenuId) {
        if (!Number.isFinite(customer.foodQuality)) prepareCafeMeal(state, customer);
        if (!Number.isFinite(customer.serviceQuality)) finishCafeServiceQuality(state, customer);
        customer.serviceStatus = 'served';
        checkoutCafeOrder(state, customer);
      } else {
        customer.foodQuality = 0;
        customer.serviceQuality = 0;
        customer.result = 'not-served';
      }
    }
    maybeLeaveReview(state, customer);
  }
  state.customers = [];
  state.waiterWork = { stage: 'idle', customerId: null, seatId: null, timer: 0, duration: 0 };
}

function endDay(state) {
  const costs = state.dailyCosts;
  const interest = Math.round(state.debt * state.creditRate * 100) / 100;
  // Rent, wages and utilities come out of the till. Interest compounds into the credit balance
  // instead (it is not also paid in cash), but it is still a cost of the day.
  const total = costs.rent + costs.payroll + costs.utilities + interest;
  state.cash = Math.round((state.cash - (total - interest)) * 100) / 100;
  state.debt = Math.round((state.debt + interest) * 100) / 100;
  state.lastDaySummary = {
    day: state.day,
    revenue: Math.round(state.dayStats.revenue * 100) / 100,
    grossProfit: Math.round(state.dayStats.grossProfit * 100) / 100,
    customers: state.dayStats.customers,
    unitsSold: state.dayStats.unitsSold,
    complaints: state.dayStats.complaints,
    waste: Math.round(state.dayStats.waste * 100) / 100,
    purchases: Math.round(state.dayStats.purchases * 100) / 100,
    expenses: { ...costs, interest },
    totalExpenses: total,
    net: Math.round((state.dayStats.grossProfit - total - state.dayStats.waste) * 100) / 100,
    cash: state.cash,
    debt: state.debt,
    averageFoodQuality: state.dayStats.ordersServed ? Math.round(state.dayStats.foodQualityTotal / state.dayStats.ordersServed) : 0,
    averageServiceQuality: state.dayStats.ordersServed ? Math.round(state.dayStats.serviceQualityTotal / state.dayStats.ordersServed) : 0,
  };
  pushEvent(state, 'close', `Day ${state.day} is in the books.`, `${money(state.dayStats.revenue)} sales · ${money(total)} running costs`);
  state.dayEnded = true;
  state.paused = true;
  state.lifetime.days += 1;
  if (state.cash < -250 || state.reputation <= 0) {
    state.gameOver = true;
    pushEvent(state, 'danger', 'The doors are shut for good.', 'The store ran out of runway.');
  }
}

export function startNextDay(state) {
  if (!state.dayEnded || state.gameOver) return false;
  state.day += 1;
  state.minute = DAY_OPEN;
  state.dayEnded = false;
  state.paused = false;
  state.customers = [];
  state.staffWork = { stage: 'idle', productId: null, timer: 0, duration: 0, moved: 0 };
  state.waiterWork = { stage: 'idle', customerId: null, seatId: null, timer: 0, duration: 0 };
  state.nextArrival = DAY_OPEN + (12 + state.random() * 20) / trafficMultiplier(state);
  state.dayStats = { revenue: 0, unitsSold: 0, customers: 0, complaints: 0, waste: 0, purchases: 0, grossProfit: 0, stockouts: 0, foodQualityTotal: 0, serviceQualityTotal: 0, ordersServed: 0 };
  pushEvent(state, 'note', `Day ${state.day} begins.`, 'Fresh start. Check the cold case before the rush.');
  return true;
}

export function borrowCredit(state, amount) {
  const value = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(value) || value <= 0) return { ok: false, reason: 'invalid-amount' };
  const available = Math.max(0, state.creditLimit - state.debt);
  if (value > available + 1e-8) return { ok: false, reason: 'credit-limit', available };
  state.debt = Math.round((state.debt + value) * 100) / 100;
  state.cash = Math.round((state.cash + value) * 100) / 100;
  pushEvent(state, 'finance', `${money(value)} drawn from the credit line.`, `Outstanding balance: ${money(state.debt)} · 1.25% daily interest`);
  return { ok: true, amount: value, debt: state.debt };
}

export function repayCredit(state, amount = state.debt) {
  const value = Math.min(state.cash, state.debt, Math.max(0, Math.floor(Number(amount) * 100 + 1e-6) / 100));
  if (!Number.isFinite(value) || value <= 0) return { ok: false, reason: 'nothing-to-repay' };
  state.cash = Math.round((state.cash - value) * 100) / 100;
  state.debt = Math.round((state.debt - value) * 100) / 100;
  pushEvent(state, 'finance', `${money(value)} credit repaid.`, `Remaining balance: ${money(state.debt)}`);
  return { ok: true, amount: value, debt: state.debt };
}

function cafeStaffQuality(id) {
  return STAFF.find((person) => person.id === id)?.quality ?? 70;
}

function prepareCafeMeal(state, customer) {
  const menuItem = CAFE_MENU_BY_ID[customer.orderedMenuId ?? customer.menuChoiceId] ?? CAFE_MENU_BY_ID['scrambled-eggs'];
  customer.orderedMenuId = menuItem.id;
  let requiredUnits = 0, fulfilledUnits = 0, freshnessTotal = 0, foodCost = 0;
  for (const [productId, required] of Object.entries(menuItem.ingredients ?? {})) {
    const product = PRODUCT_BY_ID[productId];
    const batches = sortOldestFirst(state.shelves[productId] ?? []);
    requiredUnits += required;
    let remaining = required;
    for (const batch of batches) {
      if (remaining <= 0) break;
      if (batch.qty <= 0 || isExpired(batch, productNow(state))) continue;
      const take = Math.min(remaining, batch.qty);
      batch.qty -= take;
      remaining -= take;
      fulfilledUnits += take;
      foodCost += take * (batch.unitCost ?? product?.cost ?? 0);
      const daysLeft = Math.max(0, batch.expiresAt - productNow(state));
      const freshness = product?.shelfLife ? Math.min(100, 62 + 38 * daysLeft / product.shelfLife) : 90;
      freshnessTotal += freshness * take;
    }
    state.shelves[productId] = (state.shelves[productId] ?? []).filter((batch) => batch.qty > 0);
  }
  const coverage = requiredUnits ? fulfilledUnits / requiredUnits : 1;
  const ingredientFreshness = fulfilledUnits ? freshnessTotal / fulfilledUnits : 0;
  const kitchenSkill = cafeStaffQuality('bob') * 0.72 + 84 * 0.28;
  customer.foodQuality = Math.max(1, Math.min(100, Math.round(kitchenSkill * 0.7 + ingredientFreshness * 0.3 - (1 - coverage) * 45)));
  customer.ingredientCoverage = Math.round(coverage * 100);
  customer.foodCost = Math.round(foodCost * 100) / 100;
  customer.orderedMenuName = menuItem.name;
  if (coverage < 1) {
    pushEvent(state, 'warning', `The kitchen was short on ingredients for ${customer.name}'s order.`,
      `${menuItem.name} · ${Math.round(coverage * 100)}% of the recipe was available`);
  }
}

function finishCafeServiceQuality(state, customer) {
  const elapsed = Math.max(0, state.minute - (customer.arrivedAt ?? customer.orderTakenAt ?? state.minute));
  const serviceBase = cafeStaffQuality('lou') * 0.36 + cafeStaffQuality('waiter') * 0.64;
  const timingFactor = Math.max(0.62, 1.04 - Math.max(0, elapsed - 2) * 0.025);
  customer.serviceWait = Math.round(elapsed * 10) / 10;
  customer.serviceQuality = Math.max(1, Math.min(100, Math.round(serviceBase * timingFactor)));
}

function checkoutCafeOrder(state, customer) {
  const menuItem = CAFE_MENU_BY_ID[customer.orderedMenuId];
  if (!menuItem) return checkoutCustomer(state, customer);
  const revenue = menuItem.price;
  const foodCost = customer.foodCost ?? 0;
  customer.bought = 1;
  customer.spend = revenue;
  customer.result = customer.foodQuality < 55 ? 'poor-meal' : customer.serviceQuality < 55 ? 'poor-service' : 'served';
  state.cash = Math.round((state.cash + revenue) * 100) / 100;
  state.dayStats.revenue = Math.round((state.dayStats.revenue + revenue) * 100) / 100;
  state.dayStats.unitsSold += 1;
  state.dayStats.grossProfit = Math.round((state.dayStats.grossProfit + revenue - foodCost) * 100) / 100;
  state.dayStats.foodQualityTotal += customer.foodQuality ?? 0;
  state.dayStats.serviceQualityTotal += customer.serviceQuality ?? 0;
  state.dayStats.ordersServed += 1;
  state.lifetime.revenue = Math.round((state.lifetime.revenue + revenue) * 100) / 100;
  pushEvent(state, 'sale', `${customer.name} paid for ${menuItem.name}.`,
    `Food ${customer.foodQuality}/100 · service ${customer.serviceQuality}/100 · ${money(revenue)}`);
  awardStoreExperience(state, Math.max(12, 18 + Math.floor(revenue * 1.4) + Math.round((customer.foodQuality + customer.serviceQuality) / 20)));
}

function advanceWaiterService(state, deltaMinutes) {
  let remaining = deltaMinutes;
  let transitions = 0;
  while (remaining > 1e-8 && transitions < 12) {
    let task = state.waiterWork;
    if (!task || task.stage === 'idle') {
      const next = state.customers.find((customer) =>
        customer.phase === 'browsing' && customer.serviceStatus === 'waiting' && (customer.arrivalTimer ?? 0) <= 0);
      if (!next) return;
      next.serviceStatus = 'serving';
      task = state.waiterWork = { stage: 'walking-to-table', customerId: next.id, seatId: next.seatId, timer: 1.3, duration: 1.3 };
      pushEvent(state, 'staff', `The waiter is greeting ${next.name}.`, 'Walking to the table · ready to take the breakfast order.');
    }
    const customer = state.customers.find((entry) => entry.id === task.customerId);
    if (!customer || customer.phase !== 'browsing') {
      state.waiterWork = { stage: 'idle', customerId: null, seatId: null, timer: 0, duration: 0 };
      transitions += 1;
      continue;
    }
    const step = Math.min(remaining, Math.max(0, task.timer));
    task.timer -= step;
    remaining -= step;
    if (task.timer > 1e-8) return;
    transitions += 1;

    if (task.stage === 'walking-to-table') {
      task.stage = 'taking-order';
      task.timer = task.duration = 0.55;
    } else if (task.stage === 'taking-order') {
      const menuItem = CAFE_MENU_BY_ID[customer.menuChoiceId] ?? CAFE_MENU[1];
      customer.orderedMenuId = menuItem.id;
      customer.orderedMenuName = menuItem.name;
      customer.orderTakenAt = state.minute;
      customer.serviceStatus = 'ordered';
      task.stage = 'returning-to-kitchen';
      task.timer = task.duration = 0.45;
      pushEvent(state, 'staff', `The waiter took ${customer.name}'s order.`, `${menuItem.name} · sent to kitchen`);
    } else if (task.stage === 'returning-to-kitchen') {
      task.stage = 'preparing-order';
      task.timer = task.duration = 0.9;
      pushEvent(state, 'staff', `Bob is preparing ${customer.name}'s order.`, `${customer.orderedMenuName} · breakfast made to order`);
    } else if (task.stage === 'preparing-order') {
      prepareCafeMeal(state, customer);
      task.stage = 'walking-to-delivery';
      task.timer = task.duration = 0.9;
    } else if (task.stage === 'walking-to-delivery') {
      task.stage = 'presenting';
      task.timer = task.duration = 0.4;
    } else if (task.stage === 'presenting') {
      finishCafeServiceQuality(state, customer);
      customer.serviceStatus = 'served';
      customer.servedAt = state.minute;
      task.stage = 'returning';
      task.timer = task.duration = 0.8;
      pushEvent(state, 'staff', `The waiter served ${customer.name}'s ${customer.orderedMenuName}.`,
        `Food ${customer.foodQuality}/100 · service ${customer.serviceQuality}/100`);
    } else {
      state.waiterWork = { stage: 'idle', customerId: null, seatId: null, timer: 0, duration: 0 };
    }
  }
}

function advanceCustomerPhases(state, deltaMinutes) {
  for (const customer of state.customers) {
    if (customer.phase === 'browsing' && (customer.arrivalTimer ?? 0) > 0) {
      customer.arrivalTimer = Math.max(0, customer.arrivalTimer - deltaMinutes);
      continue;
    }
    if (customer.phase === 'browsing' && customer.serviceStatus && customer.serviceStatus !== 'served') continue;
    customer.phaseTimer -= deltaMinutes;
    if (customer.phaseTimer > 0) continue;
    if (customer.phase === 'browsing') {
      if (customer.orderedMenuId) checkoutCafeOrder(state, customer);
      else checkoutCustomer(state, customer);
      customer.phase = 'checkout';
      customer.phaseTotal = 3.8;
      customer.phaseTimer = customer.phaseTotal;
    } else if (customer.phase === 'checkout') {
      customer.phase = 'leaving';
      customer.phaseTotal = 3.2;
      customer.phaseTimer = customer.phaseTotal;
    } else if (customer.phase === 'leaving') {
      maybeLeaveReview(state, customer);
      customer.phase = 'gone';
      customer.phaseTimer = 0;
    }
  }
  state.customers = state.customers.filter((customer) => customer.phase !== 'gone');
}

/** Real frame time adjusted to the store's selected speed; zero while closed or paused. */
export function activeFrameDelta(state, realSeconds) {
  if (!state.started || state.paused || state.dayEnded || state.gameOver
    || !Number.isFinite(realSeconds) || realSeconds <= 0) return 0;
  const speed = Number.isFinite(state.speed) && state.speed > 0 ? state.speed : 1;
  return realSeconds * speed;
}

/** Advance the store clock by game-minutes (not real seconds). */
export function advanceGame(state, deltaMinutes) {
  if (!state.started || state.paused || state.dayEnded || state.gameOver || !Number.isFinite(deltaMinutes) || deltaMinutes <= 0) return;
  let remaining = deltaMinutes;
  while (remaining > 0 && !state.dayEnded) {
    const untilArrival = Math.max(0, state.nextArrival - state.minute);
    const untilClose = DAY_CLOSE - state.minute;
    const step = Math.min(remaining, Math.max(0.02, untilArrival || 0.02), untilClose);
    state.minute += step;
    remaining -= step;
    advanceCustomerPhases(state, step);
    advanceWaiterService(state, step);
    if (state.minute >= state.nextArrival && state.minute < LAST_CALL) {
      spawnCustomer(state);
      state.nextArrival = state.minute + customerArrivalInterval(state);
    }
    if (state.reputation <= 0) { endDay(state); state.gameOver = true; break; }
    if (state.minute >= DAY_CLOSE - 1e-6) {
      state.minute = DAY_CLOSE;
      finishCustomersAtClose(state);
      endDay(state);
      break;
    }
  }
}

export function beginDay(state) {
  if (state.started || state.gameOver) return false;
  state.started = true;
  state.paused = false;
  state.nextArrival = state.minute + (10 + state.random() * 14) / trafficMultiplier(state);
  pushEvent(state, 'good', 'The shutters are up.', 'First customer should be along shortly.');
  return true;
}

export function togglePause(state) {
  if (!state.started || state.dayEnded || state.gameOver) return state.paused;
  state.paused = !state.paused;
  return state.paused;
}
