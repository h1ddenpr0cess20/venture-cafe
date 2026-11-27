import { CAFE_AREAS } from './layout.js';
import { CAFE_MENU, CAFE_MENU_BY_ID } from './menu.js';
import { RESIDENTS, RESIDENT_BY_ID } from './residents.js';

export { RESIDENTS, RESIDENT_BY_ID };

/**
 * Venture Cafe's authoritative simulation.
 * All dates are measured in fractional days. A lot's expiry is fixed when it is delivered, and the kitchen
 * always cooks from the oldest valid lot first (FEFO), so nothing is buried behind a fresher delivery.
 */

/**
 * What the kitchen cooks with. A unit is one portion of it: an egg, a slice of bread, a pat of butter, a cup's worth of grounds.
 * `caseSize` is how many units the supplier delivers in a case; `shelfLife` is in days. `level` (below) is the cafe level
 * at which the first dish that needs it goes on the menu.
 */
const INGREDIENT_LIST = [
  { id: 'eggs', name: 'Large brown eggs', short: 'Eggs', category: 'Eggs', cost: 0.32, shelfLife: 28, caseSize: 60, color: '#c9a77a', description: 'Check the date and keep them cold. Everything on the pass starts here.' },
  { id: 'butter', name: 'Salted butter', short: 'Butter', category: 'Dairy', cost: 0.22, shelfLife: 36, caseSize: 80, color: '#e8d58a', description: 'A pat for the pan, a pat for the toast.' },
  { id: 'milk', name: 'Whole milk', short: 'Milk', category: 'Dairy', cost: 0.25, shelfLife: 6, caseSize: 40, color: '#e5e1cf', description: 'Turns fast. Order it in small, frequent cases.' },
  { id: 'bread', name: 'Thick-cut sandwich bread', short: 'Bread', category: 'Bakery', cost: 0.28, shelfLife: 5, caseSize: 40, color: '#bd8950', description: 'Delivered often. Stales quickly.' },
  { id: 'coffee', name: 'House blend coffee', short: 'Coffee', category: 'Drinks', cost: 0.3, shelfLife: 180, caseSize: 60, color: '#81533d', description: 'A cup\'s worth of grounds. Keeps for months.' },
  { id: 'potatoes', name: 'Russet potatoes', short: 'Potatoes', category: 'Produce', cost: 0.3, shelfLife: 18, caseSize: 40, color: '#a77b4f', description: 'A sturdy staple for the skillet.' },
  { id: 'orangejuice', name: 'Fresh orange juice', short: 'Orange juice', category: 'Drinks', cost: 0.85, shelfLife: 12, caseSize: 24, color: '#f5a21e', description: 'Poured cold, to order, over ice.' },
  { id: 'cheese', name: 'Sharp cheddar', short: 'Cheddar', category: 'Dairy', cost: 0.55, shelfLife: 24, caseSize: 30, color: '#e4a93d', description: 'Grated into the diner omelette.' },
  { id: 'tomatoes', name: 'Vine tomatoes', short: 'Tomatoes', category: 'Produce', cost: 0.35, shelfLife: 5, caseSize: 36, color: '#d94b39', description: 'Ripe, and soon too ripe.' },
];
export const INGREDIENTS = INGREDIENT_LIST.map((ingredient) => ({
  ...ingredient,
  level: Math.min(...CAFE_MENU.filter((item) => ingredient.id in (item.ingredients ?? {})).map((item) => item.level ?? 1)),
}));
export const INGREDIENT_BY_ID = Object.fromEntries(INGREDIENTS.map((ingredient) => [ingredient.id, ingredient]));

/** What a dish costs the kitchen to make, at the ingredients' wholesale cost. */
export const recipeCost = (item) => Math.round(Object.entries(item.ingredients ?? {}).reduce((sum, [id, qty]) => sum + INGREDIENT_BY_ID[id].cost * qty, 0) * 100) / 100;

export const STAFF = [
  { id: 'lou', name: 'Lou Rivera', role: 'Host · greets and seats guests', wage: 14, color: '#e0b982', quality: 86 },
  { id: 'bob', name: 'Bob', role: 'Line cook · breakfast preparation', wage: 12, color: '#64a9a3', quality: 88 },
  { id: 'waiter', name: 'Waiter', role: 'Dining room · table service', wage: 15, color: '#c5a06a', quality: 82 },
];

/**
 * A small, hand-written review history establishes the shop's reputation
 * before the new owner takes over. New reviews are chosen from the banks
 * below, then personalized with the guest and the dish they came for.
 */
const OPENING_REVIEWS = [
  { id: 1, name: 'A. Brooks', rating: 5, text: 'The soft eggs are lovely and Lou remembers exactly how I take my coffee.', day: 0, minute: 0, source: 'Local regular' },
  { id: 2, name: 'S. Morales', rating: 4, text: 'A proper neighborhood breakfast cafe. Bob makes a great coffee and the booths are comfortable.', day: 0, minute: 0, source: 'Local regular' },
  { id: 3, name: 'J. Kim', rating: 5, text: 'Good toast, strong coffee and a sunny-side-up egg cooked just right. I will be back.', day: 0, minute: 0, source: 'Nearby resident' },
  { id: 4, name: 'T. Rivera', rating: 4, text: 'A welcoming little cafe with a real breakfast menu and friendly service.', day: 0, minute: 0, source: 'Nearby resident' },
];

const STARTING_CASH = 1250;
const CREDIT_LIMIT = 1800;
const DAY_OPEN = 7 * 60;
const DAY_CLOSE = 21 * 60;
/** The last diner is let in this long before closing, so everyone is served before the shutters come down. */
const LAST_CALL = DAY_CLOSE - 30;
const EXPIRY_BUFFER = 1e-8;
const STAFF_PAYROLL = STAFF.reduce((n, s) => n + s.wage, 0);
const STORE_LEVEL_XP = 250;
const SAVE_VERSION = 2;
export const getStoreLevel = (state) => 1 + Math.floor(Math.max(0, state.experience ?? 0) / STORE_LEVEL_XP);
export function getStoreLevelProgress(state) {
  const level = getStoreLevel(state);
  const floor = (level - 1) * STORE_LEVEL_XP;
  const next = level * STORE_LEVEL_XP;
  const experience = Math.max(0, state.experience ?? 0);
  return { level, experience, currentFloor: floor, nextTarget: next, remaining: Math.max(0, next - experience), progress: Math.max(0, Math.min(100, (experience - floor) / STORE_LEVEL_XP * 100)) };
}

/** Whether the cafe's level has opened an ingredient (a dish that needs it is on the menu). */
export const isOpen = (state, ingredient) => {
  if (typeof ingredient === 'string') ingredient = INGREDIENT_BY_ID[ingredient];
  return !!ingredient && getStoreLevel(state) >= ingredient.level;
};
export const openIngredients = (state) => INGREDIENTS.filter((ingredient) => isOpen(state, ingredient));
/** The dishes on the menu at the cafe's level. */
export const openMenu = (state) => CAFE_MENU.filter((item) => (item.level ?? 1) <= getStoreLevel(state));

export const money = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
export const productNow = (state) => state.day + state.minute / 1440;
export const qtyOf = (batches = []) => batches.reduce((n, batch) => n + batch.qty, 0);
export const isExpired = (batch, now) => batch.expiresAt <= now + EXPIRY_BUFFER;
export const expiryDaysLeft = (batch, now) => Math.max(0, batch.expiresAt - now);
export const sortOldestFirst = (batches) => batches.sort((a, b) => a.expiresAt - b.expiresAt || a.receivedAt - b.receivedAt || a.lotId - b.lotId);


function pushEvent(state, type, message, detail = '') {
  state.events.unshift({ id: ++state.eventSequence, type, message, detail, time: state.minute, day: state.day });
  state.events.length = Math.min(state.events.length, 32);
}

function newLot(state, ingredient, qty, { age = 0 } = {}) {
  const now = productNow(state);
  return {
    lotId: ++state.lotSequence,
    qty,
    receivedAt: now - age,
    expiresAt: now + ingredient.shelfLife - age,
    unitCost: ingredient.cost,
  };
}

const emptyDayStats = () => ({ revenue: 0, unitsSold: 0, customers: 0, complaints: 0, waste: 0, purchases: 0, grossProfit: 0, stockouts: 0, pricedOut: 0, foodQualityTotal: 0, serviceQualityTotal: 0, ordersServed: 0 });
const emptyWaiterWork = () => ({ stage: 'idle', customerId: null, seatId: null, timer: 0, duration: 0 });

export function createGameState(seed = 20261031) {
  const random = createRng(seed);
  const state = {
    version: SAVE_VERSION,
    day: 1,
    minute: DAY_OPEN,
    cash: STARTING_CASH,
    debt: 0,
    creditLimit: CREDIT_LIMIT,
    creditRate: 0.0125,
    reputation: 78,
    experience: 0,
    playerPosition: { x: 1.1, z: -6.35 },
    started: false,
    paused: true,
    dayEnded: false,
    gameOver: false,
    speed: 1,
    pantry: Object.fromEntries(INGREDIENTS.map((ingredient) => [ingredient.id, []])),
    menuPrices: Object.fromEntries(CAFE_MENU.map((item) => [item.id, item.price])),
    customers: [],
    nextArrival: DAY_OPEN + 18,
    customerSequence: 0,
    partySequence: 0,
    lotSequence: 0,
    eventSequence: 0,
    events: [],
    reviews: OPENING_REVIEWS.map((review) => ({ ...review })).reverse(),
    reviewSequence: OPENING_REVIEWS.length,
    random,
    dayStats: emptyDayStats(),
    lifetime: { revenue: 0, customers: 0, complaints: 0, waste: 0, days: 0 },
    dailyCosts: { rent: 24, payroll: STAFF_PAYROLL, utilities: 8 },
    supplierOrders: 0,
    orderCases: Object.fromEntries(INGREDIENTS.map((ingredient) => [ingredient.id, 1])),
    waiterWork: emptyWaiterWork(),
    lastDaySummary: null,
  };
  // The walk-in starts stocked for the opening menu, with a slightly older delivery of the fast movers
  // so that date rotation is a real first-day responsibility.
  for (const ingredient of INGREDIENTS.filter((candidate) => candidate.level <= 1)) {
    const opening = Math.round(ingredient.caseSize * 0.7);
    if (['milk', 'bread'].includes(ingredient.id)) state.pantry[ingredient.id].push(newLot(state, ingredient, Math.round(opening * 0.3), { age: Math.min(1.5, ingredient.shelfLife * 0.3) }));
    state.pantry[ingredient.id].push(newLot(state, ingredient, ['milk', 'bread'].includes(ingredient.id) ? Math.round(opening * 0.7) : opening));
    sortOldestFirst(state.pantry[ingredient.id]);
  }
  pushEvent(state, 'note', 'The keys are yours.', 'Lou, Bob and the waiter are ready for breakfast service.');
  pushEvent(state, 'stock', 'The walk-in is stocked for the opening menu.', 'The kitchen cooks from the oldest valid date first.');
  return state;
}

export const pantryQuantity = (state, id) => qtyOf(state.pantry[id]);
export function expiredQuantity(state, id) {
  const now = productNow(state);
  return qtyOf((state.pantry[id] ?? []).filter((lot) => isExpired(lot, now)));
}
export function oldestLot(state, id) {
  sortOldestFirst(state.pantry[id]);
  return state.pantry[id][0] ?? null;
}
/** A count of what needs attention in the walk-in: expired units, ingredients running low (under a quarter of a case) and ones gone. */
export function pantryHealth(state) {
  const now = productNow(state);
  return openIngredients(state).reduce((out, ingredient) => {
    const lots = state.pantry[ingredient.id];
    const good = qtyOf(lots.filter((lot) => !isExpired(lot, now)));
    out.expired += qtyOf(lots.filter((lot) => isExpired(lot, now)));
    out.low += good > 0 && good < ingredient.caseSize * 0.25 ? 1 : 0;
    out.empty += good === 0 ? 1 : 0;
    return out;
  }, { expired: 0, low: 0, empty: 0 });
}

/** Place a wholesale case order. It is delivered straight to the walk-in. */
export function placeOrder(state, id, cases = 1) {
  const ingredient = INGREDIENT_BY_ID[id];
  const count = Math.floor(Number(cases));
  if (!ingredient || !Number.isFinite(count) || count < 1 || count > 20) return { ok: false, reason: 'invalid-quantity' };
  if (!isOpen(state, ingredient)) return { ok: false, reason: 'not-stocked' };
  const qty = ingredient.caseSize * count;
  const total = Math.round(ingredient.cost * qty * 100) / 100;
  if (state.cash + 1e-8 < total) return { ok: false, reason: 'insufficient-funds', total, shortfall: total - state.cash };
  state.cash = Math.round((state.cash - total) * 100) / 100;
  state.pantry[id].push(newLot(state, ingredient, qty));
  sortOldestFirst(state.pantry[id]);
  state.dayStats.purchases += total;
  state.supplierOrders += 1;
  pushEvent(state, 'order', `${count} case${count === 1 ? '' : 's'} of ${ingredient.short.toLowerCase()} delivered.`, `${qty} portions · ${money(total)} · into the walk-in`);
  return { ok: true, qty, total, expiresAt: productNow(state) + ingredient.shelfLife };
}

/** Change a dish's menu price. It can go as low as 20% over what the dish costs to make, and as high as 60% over its base price. */
export function adjustMenuPrice(state, itemId, delta) {
  const item = CAFE_MENU_BY_ID[itemId];
  if (!item || !Number.isFinite(delta)) return false;
  const next = Math.round(((state.menuPrices[itemId] ?? item.price) + delta) * 100) / 100;
  state.menuPrices[itemId] = Math.max(Math.ceil(recipeCost(item) * 1.2 * 4) / 4, Math.min(item.price * 1.6, next));
  return true;
}

/** Remove all expired units. Waste is recorded at cost, not menu price. */
export function pullExpired(state, id = null) {
  const ids = id ? [id] : INGREDIENTS.map((ingredient) => ingredient.id);
  const now = productNow(state);
  let removed = 0, loss = 0;
  for (const key of ids) {
    if (!state.pantry[key]) continue;
    const keep = [];
    for (const lot of state.pantry[key]) {
      if (isExpired(lot, now)) { removed += lot.qty; loss += lot.qty * lot.unitCost; } else keep.push(lot);
    }
    state.pantry[key] = sortOldestFirst(keep);
  }
  if (removed) {
    state.dayStats.waste += loss;
    state.lifetime.waste += loss;
    pushEvent(state, 'waste', `${removed} expired portions pulled.`, `${money(loss)} written off at wholesale cost.`);
  } else pushEvent(state, 'good', 'No expired stock found.', 'The walk-in is clear.');
  return { removed, loss };
}

/** Who walks in next: anyone not already in the cafe, regulars leaning toward their usual hours. */
export function chooseResident(state, alsoExclude = []) {
  const inside = new Set([...state.customers.map((c) => c.residentId), ...alsoExclude]);
  const hour = state.minute / 60;
  // `availableResidents` (a Set of ids, set by the world as their people finish building) is not saved.
  const ready = state.availableResidents?.size ? RESIDENTS.filter((r) => state.availableResidents.has(r.id)) : RESIDENTS;
  const pool = ready.filter((r) => !inside.has(r.id));
  const weights = pool.map((r) => (hour >= r.peak[0] && hour < r.peak[1] ? 3 : 1));
  let roll = state.random() * weights.reduce((n, w) => n + w, 0);
  for (let i = 0; i < pool.length; i++) { roll -= weights[i]; if (roll <= 0) return pool[i]; }
  return pool[pool.length - 1] ?? ready[0] ?? RESIDENTS[0];
}

/** What a regular orders: any dish on the menu, the ones they like three times as often. */
export function chooseDish(state, resident) {
  const menu = openMenu(state);
  const weights = menu.map((item) => (resident.likes.includes(item.id) ? 3 : 1));
  let roll = state.random() * weights.reduce((n, w) => n + w, 0);
  for (let i = 0; i < menu.length; i++) { roll -= weights[i]; if (roll <= 0) return menu[i]; }
  return menu[menu.length - 1] ?? CAFE_MENU_BY_ID['scrambled-eggs'];
}

const MAX_GUESTS = 14;

/** A party of one to four: mostly pairs and singles, now and then a table of three or four. */
function rollPartySize(state) {
  const roll = state.random();
  return roll < 0.3 ? 1 : roll < 0.72 ? 2 : roll < 0.88 ? 3 : 4;
}

/**
 * Where a party sits. A table or booth is one party's (strangers never share one); the bar is shared, but only
 * singles and pairs sit at it. Among the areas that fit, a party picks one at random, weighted toward what suits
 * its size: singles lean to the bar, pairs to tables and booths, bigger parties to tables.
 */
function chooseArea(state, size, taken) {
  const free = (area) => area.seats.filter((seat) => !taken.has(seat.id));
  const options = CAFE_AREAS.map((area) => {
    const open = free(area);
    if (area.kind === 'bar') return { area, open, weight: size <= 2 && open.length >= size ? (size === 1 ? 3 : 1) : 0 };
    const empty = open.length === area.seats.length;
    const fits = empty && area.seats.length >= size;
    return { area, open, weight: !fits ? 0 : area.kind === 'booth' ? (size === 1 ? 1 : 2) : size >= 3 ? 3 : size === 2 ? 2 : 1 };
  }).filter((option) => option.weight > 0);
  if (!options.length) return null;
  let roll = state.random() * options.reduce((n, option) => n + option.weight, 0);
  for (const option of options) { roll -= option.weight; if (roll <= 0) return option; }
  return options[options.length - 1];
}

const AREA_PHRASE = { table: 'a table', booth: 'a booth', bar: 'the bar' };
const joinNames = (names) => (names.length < 2 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/** A party walks in together, takes seats together, and is served together. Returns the guests who came in. */
function spawnParty(state) {
  const room = MAX_GUESTS - state.customers.length;
  if (room <= 0) return [];
  const taken = new Set(state.customers.map((customer) => customer.seatId).filter(Boolean));
  let size = Math.min(rollPartySize(state), room);
  let option = null;
  while (size >= 1 && !(option = chooseArea(state, size, taken))) size -= 1;      // no room for the whole party: a smaller one comes in
  if (!option) return [];
  let open = option.open;
  if (option.area.kind === 'bar') {                                                 // friends at the bar sit side by side
    const start = Math.floor(state.random() * (open.length - size + 1));
    open = open.slice(start, start + size);
  }
  const partyId = ++state.partySequence;
  const browseTime = 12 + state.random() * 5 + (size - 1) * 2.5;
  const names = [], members = [];
  for (let index = 0; index < size; index += 1) {
    const resident = chooseResident(state, members.map((member) => member.residentId));
    const seat = open[index];
    const dish = chooseDish(state, resident);
    const customer = {
      id: ++state.customerSequence,
      partyId, partySize: size, partyIndex: index,
      residentId: resident.id,
      name: resident.name,
      reviewName: `${resident.full.split(' ')[0][0]}. ${resident.full.split(' ').slice(-1)[0]}`,
      tag: resident.tag,
      thrift: resident.thrift,
      menuChoiceId: dish.id,
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
      arrivalTimer: 2.4 + index * 0.55,                   // a party comes through the door one after another
      serviceStatus: 'waiting',
      phase: 'browsing',
      phaseTotal: browseTime,
      phaseTimer: browseTime,
      result: null,
      bought: 0,
      spend: 0,
    };
    state.customers.push(customer);
    members.push(customer);
    names.push(resident.name);
    state.dayStats.customers += 1;
    state.lifetime.customers += 1;
  }
  pushEvent(state, 'customer', `${joinNames(names)} took ${AREA_PHRASE[option.area.kind]}.`, size === 1 ? 'Dining room · waiting to order' : `Party of ${size} · waiting to order`);
  return members;
}

function awardStoreExperience(state, amount) {
  const previousLevel = getStoreLevel(state);
  state.experience = Math.max(0, Math.floor((state.experience ?? 0) + amount));
  const level = getStoreLevel(state);
  if (level > previousLevel) {
    const opened = CAFE_MENU.filter((item) => (item.level ?? 1) > previousLevel && (item.level ?? 1) <= level).map((item) => item.name);
    pushEvent(state, 'level', `Cafe level up · Level ${level}!`, opened.length ? `New on the menu: ${opened.join(', ')}.` : `Cafe experience: ${state.experience}.`);
  }
}


function cafeStaffQuality(id) {
  return STAFF.find((person) => person.id === id)?.quality ?? 70;
}

function prepareCafeMeal(state, customer) {
  const menuItem = CAFE_MENU_BY_ID[customer.orderedMenuId ?? customer.menuChoiceId] ?? CAFE_MENU_BY_ID['scrambled-eggs'];
  customer.orderedMenuId = menuItem.id;
  let requiredUnits = 0, fulfilledUnits = 0, freshnessTotal = 0, foodCost = 0;
  for (const [id, required] of Object.entries(menuItem.ingredients ?? {})) {
    const ingredient = INGREDIENT_BY_ID[id];
    const lots = sortOldestFirst(state.pantry[id] ?? []);
    requiredUnits += required;
    let remaining = required;
    for (const lot of lots) {
      if (remaining <= 0) break;
      if (lot.qty <= 0 || isExpired(lot, productNow(state))) continue;
      const take = Math.min(remaining, lot.qty);
      lot.qty -= take;
      remaining -= take;
      fulfilledUnits += take;
      foodCost += take * (lot.unitCost ?? ingredient?.cost ?? 0);
      const daysLeft = Math.max(0, lot.expiresAt - productNow(state));
      const freshness = ingredient?.shelfLife ? Math.min(100, 62 + 38 * daysLeft / ingredient.shelfLife) : 90;
      freshnessTotal += freshness * take;
    }
    state.pantry[id] = (state.pantry[id] ?? []).filter((lot) => lot.qty > 0);
  }
  const coverage = requiredUnits ? fulfilledUnits / requiredUnits : 1;
  const ingredientFreshness = fulfilledUnits ? freshnessTotal / fulfilledUnits : 0;
  const kitchenSkill = cafeStaffQuality('bob') * 0.72 + 84 * 0.28;
  customer.foodQuality = Math.max(1, Math.min(100, Math.round(kitchenSkill * 0.7 + ingredientFreshness * 0.3 - (1 - coverage) * 45)));
  customer.ingredientCoverage = Math.round(coverage * 100);
  customer.foodCost = Math.round(foodCost * 100) / 100;
  customer.orderedMenuName = menuItem.name;
  if (coverage < 1) {
    state.dayStats.stockouts += 1;
    state.reputation = Math.max(0, state.reputation - 0.25);
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
  if (!menuItem) { customer.result = 'not-served'; return; }
  const revenue = state.menuPrices[menuItem.id] ?? menuItem.price;
  const foodCost = customer.foodCost ?? 0;
  // A guest still pays, but calls the cafe pricey if the dish costs more than they think it is worth.
  const pricey = revenue > menuItem.price * (1 + (customer.thrift ?? 0.4)) + 1e-9;
  customer.bought = 1;
  customer.spend = revenue;
  customer.pricey = pricey;
  customer.result = customer.foodQuality < 55 ? 'poor-meal' : customer.serviceQuality < 55 ? 'poor-service' : pricey ? 'pricey' : 'served';
  if (pricey) {
    state.dayStats.pricedOut += 1;
    state.reputation = Math.max(0, state.reputation - 0.15);
    pushEvent(state, 'warning', `${customer.name} thought the ${menuItem.name.toLowerCase()} was pricey.`, `${money(revenue)} was more than they would pay.`);
  }
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



/** Restore a save while keeping the simulation's functions out of storage. Saves from before the cafe's own pantry (version 2) start fresh. */
export function loadGameState(serialized) {
  try {
    const saved = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
    if (!saved || saved.version !== SAVE_VERSION || !Number.isFinite(saved.day) || !saved.pantry) return null;
    const state = createGameState(saved.rngState ?? 1);
    Object.assign(state, saved);
    state.random = createRng(saved.rngState ?? 1);
    state.paused = false; // Resume active days on reload; no offline time is simulated.
    // Saves from before an ingredient existed have no stock record for it.
    for (const ingredient of INGREDIENTS) state.pantry[ingredient.id] ??= [];
    state.menuPrices = { ...Object.fromEntries(CAFE_MENU.map((item) => [item.id, item.price])), ...state.menuPrices };
    state.orderCases = { ...Object.fromEntries(INGREDIENTS.map((ingredient) => [ingredient.id, 1])), ...state.orderCases };
    state.dayStats = { ...emptyDayStats(), ...state.dayStats };
    state.reviews ??= OPENING_REVIEWS.map((review) => ({ ...review })).reverse();
    state.reviewSequence ??= Math.max(0, ...state.reviews.map((review) => review.id || 0));
    state.waiterWork ??= emptyWaiterWork();
    state.partySequence ??= Math.max(0, ...state.customers.map((customer) => customer.partyId ?? 0));
    for (const customer of state.customers) {
      customer.arrivalDuration ??= 2.4;
      customer.arrivalTimer ??= 0;
      customer.thrift ??= RESIDENT_BY_ID[customer.residentId]?.thrift ?? 0.4;
      if (!customer.serviceStatus) customer.serviceStatus = customer.phase === 'browsing' ? 'waiting' : 'served';
      customer.foodQuality ??= null;
      customer.serviceQuality ??= null;
    }
    state.playerPosition ??= { x: 1.1, z: -6.35 };
    state.dailyCosts.payroll = STAFF_PAYROLL;
    return state;
  } catch { return null; }
}

const CAFE_QUALITY_REVIEW_BANK = Object.freeze({
  pricey: [
    'Lovely breakfast, but the menu prices have crept up. I would come more often if they came down a little.',
    'Good food and a warm room, though I paid more than I expected for eggs and toast.',
    'The cooking is right, the bill is a stretch. A fair price would make this my weekly spot.',
    'Nice place, friendly service. A touch pricey for a neighborhood cafe.',
  ],
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


function leaveCafeQualityReview(state, customer) {
  const foodQuality = Math.max(0, Math.min(100, Number(customer.foodQuality) || 0));
  const serviceQuality = Math.max(0, Math.min(100, Number(customer.serviceQuality) || 0));
  const overall = foodQuality * 0.55 + serviceQuality * 0.45;
  const chance = overall < 58 ? 0.72 : overall < 72 ? 0.56 : 0.38;
  if (state.random() >= chance) return null;
  const rating = Math.min(customer.pricey ? 3 : 5, overall >= 91 ? 5 : overall >= 78 ? 4 : overall >= 65 ? 3 : overall >= 50 ? 2 : 1);
  const bankName = foodQuality < 58 && serviceQuality < 58 ? 'poor'
    : foodQuality < serviceQuality - 8 ? 'foodPoor'
      : serviceQuality < foodQuality - 8 ? 'servicePoor'
        : customer.pricey ? 'pricey'
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
 * Publish an occasional post-visit review. Unhappy customers are substantially more likely to write one, and a
 * one-star review costs more neighborhood trust than a short order. Reviews also alter the arrival interval below.
 */
export function maybeLeaveReview(state, customer) {
  if (customer.reviewLeft) return null;
  if (!Number.isFinite(customer.foodQuality) || !Number.isFinite(customer.serviceQuality)) return null;
  return leaveCafeQualityReview(state, customer);
}


/** The same neighborhood reputation that earns reviews also determines footfall. */
export function customerArrivalInterval(state) {
  return (30 + state.random() * 24) / trafficMultiplier(state);
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
  state.waiterWork = emptyWaiterWork();
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
    pushEvent(state, 'danger', 'The doors are shut for good.', 'The cafe ran out of runway.');
  }
}

export function startNextDay(state) {
  if (!state.dayEnded || state.gameOver) return false;
  state.day += 1;
  state.minute = DAY_OPEN;
  state.dayEnded = false;
  state.paused = false;
  state.customers = [];
    state.waiterWork = emptyWaiterWork();
  state.nextArrival = DAY_OPEN + (10 + state.random() * 16) / trafficMultiplier(state);
  state.dayStats = emptyDayStats();
  pushEvent(state, 'note', `Day ${state.day} begins.`, 'Fresh start. Check the walk-in before the rush.');
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
      // Already at this party's table: the rest of the party is served without another walk to the kitchen and back.
      const fast = !!next.partyId && state.lastServed?.partyId === next.partyId && state.minute - state.lastServed.at < 8;
      const k = fast ? 0.35 : 1;
      task = state.waiterWork = { stage: 'walking-to-table', customerId: next.id, seatId: next.seatId, timer: 1.3 * k, duration: 1.3 * k, k };
      pushEvent(state, 'staff', `The waiter is greeting ${next.name}.`, 'Walking to the table · ready to take the breakfast order.');
    }
    const customer = state.customers.find((entry) => entry.id === task.customerId);
    if (!customer || customer.phase !== 'browsing') {
      state.waiterWork = emptyWaiterWork();
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
      task.timer = task.duration = 0.55 * (task.k ?? 1);
    } else if (task.stage === 'taking-order') {
      const menuItem = CAFE_MENU_BY_ID[customer.menuChoiceId] ?? CAFE_MENU[1];
      customer.orderedMenuId = menuItem.id;
      customer.orderedMenuName = menuItem.name;
      customer.orderTakenAt = state.minute;
      customer.serviceStatus = 'ordered';
      task.stage = 'returning-to-kitchen';
      task.timer = task.duration = 0.45 * (task.k ?? 1);
      pushEvent(state, 'staff', `The waiter took ${customer.name}'s order.`, `${menuItem.name} · sent to kitchen`);
    } else if (task.stage === 'returning-to-kitchen') {
      task.stage = 'preparing-order';
      task.timer = task.duration = 0.9 * ((task.k ?? 1) < 1 ? 0.6 : 1);
      pushEvent(state, 'staff', `Bob is preparing ${customer.name}'s order.`, `${customer.orderedMenuName} · breakfast made to order`);
    } else if (task.stage === 'preparing-order') {
      prepareCafeMeal(state, customer);
      task.stage = 'walking-to-delivery';
      task.timer = task.duration = 0.9 * (task.k ?? 1);
    } else if (task.stage === 'walking-to-delivery') {
      task.stage = 'presenting';
      task.timer = task.duration = 0.4 * (task.k ?? 1);
    } else if (task.stage === 'presenting') {
      finishCafeServiceQuality(state, customer);
      customer.serviceStatus = 'served';
      customer.servedAt = state.minute;
      task.stage = 'returning';
      task.timer = task.duration = 0.8 * (task.k ?? 1);
      state.lastServed = { partyId: customer.partyId ?? null, at: state.minute };
      pushEvent(state, 'staff', `The waiter served ${customer.name}'s ${customer.orderedMenuName}.`,
        `Food ${customer.foodQuality}/100 · service ${customer.serviceQuality}/100`);
    } else {
      state.waiterWork = emptyWaiterWork();
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
      checkoutCafeOrder(state, customer);
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
      spawnParty(state);
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
  state.nextArrival = state.minute + (8 + state.random() * 12) / trafficMultiplier(state);
  pushEvent(state, 'good', 'The cafe is open.', 'First customer should be along shortly.');
  return true;
}

export function togglePause(state) {
  if (!state.started || state.dayEnded || state.gameOver) return state.paused;
  state.paused = !state.paused;
  return state.paused;
}
